/**
 * The tokenizer for dCBOR diagnostic notation.
 *
 * @module token
 */

import { CborDate, hexToBytes } from "@blockchaincommons/dcbor";
import { UR } from "@blockchaincommons/uniform-resources";
import { type DcborResult, type Span, span, DcborParseError } from "./error";

/**
 * A token of the notation, with its span.
 *
 * The six literal kinds carry their decoded value or, when the text matched
 * the literal's pattern but did not decode (an odd number of hex digits, a
 * non-canonical base64 body, an impossible date, a tag or known-value number
 * past 2⁶⁴ − 1, a UR the decoder rejects), the error the parser reports for
 * it. `TagValue` and `KnownValueNumber` accept the full unsigned 64-bit
 * range: a value that fits in `Number.MAX_SAFE_INTEGER` is a `number`,
 * anything larger a `bigint`, so no precision is lost. A `String` token
 * holds its source text, quotes included; escape sequences are kept as
 * written.
 */
export type Token = {
  /** Where the token sits in the source, in UTF-16 code units. */
  readonly span: Span;
} & (
  | {
      /** The discriminant. */
      readonly type: "Bool";
      /** `true` or `false`. */
      readonly value: boolean;
    }
  | {
      /** The discriminant. */
      readonly type: "BraceOpen";
    }
  | {
      /** The discriminant. */
      readonly type: "BraceClose";
    }
  | {
      /** The discriminant. */
      readonly type: "BracketOpen";
    }
  | {
      /** The discriminant. */
      readonly type: "BracketClose";
    }
  | {
      /** The discriminant. */
      readonly type: "ParenthesisOpen";
    }
  | {
      /** The discriminant. */
      readonly type: "ParenthesisClose";
    }
  | {
      /** The discriminant. */
      readonly type: "Colon";
    }
  | {
      /** The discriminant. */
      readonly type: "Comma";
    }
  | {
      /** The discriminant. */
      readonly type: "Null";
    }
  | {
      /** The discriminant. */
      readonly type: "NaN";
    }
  | {
      /** The discriminant. */
      readonly type: "Infinity";
    }
  | {
      /** The discriminant. */
      readonly type: "NegInfinity";
    }
  | {
      /** The discriminant. */
      readonly type: "ByteStringHex";
      /** The bytes, or `InvalidHexString` for an odd number of digits. */
      readonly value: DcborResult<Uint8Array, DcborParseError>;
    }
  | {
      /** The discriminant. */
      readonly type: "ByteStringBase64";
      /** The bytes, or `InvalidBase64String` for a body that is not canonical base64. */
      readonly value: DcborResult<Uint8Array, DcborParseError>;
    }
  | {
      /** The discriminant. */
      readonly type: "DateLiteral";
      /** The date, or `InvalidDateString` for text the date parser rejects. */
      readonly value: DcborResult<CborDate, DcborParseError>;
    }
  | {
      /** The discriminant. */
      readonly type: "Number";
      /** The number, as `parseFloat` reads it. */
      readonly value: number;
    }
  | {
      /** The discriminant. */
      readonly type: "String";
      /** The source text, quotes included; escapes as written. */
      readonly value: string;
    }
  | {
      /** The discriminant. */
      readonly type: "TagValue";
      /** The tag number, or `InvalidTagValue` past 2⁶⁴ − 1. */
      readonly value: DcborResult<number | bigint, DcborParseError>;
    }
  | {
      /** The discriminant. */
      readonly type: "TagName";
      /** The name before the `(`. */
      readonly value: string;
    }
  | {
      /** The discriminant. */
      readonly type: "KnownValueNumber";
      /** The known-value number, or `InvalidKnownValue` past 2⁶⁴ − 1. */
      readonly value: DcborResult<number | bigint, DcborParseError>;
    }
  | {
      /** The discriminant. */
      readonly type: "KnownValueName";
      /** The name between the quotes; empty for `''`. */
      readonly value: string;
    }
  | {
      /** The discriminant. */
      readonly type: "Unit";
    }
  | {
      /** The discriminant. */
      readonly type: "UR";
      /** The decoded UR, or `InvalidUr` for one the decoder rejects. */
      readonly value: DcborResult<UR, DcborParseError>;
    }
);

/** The kind of a token: its `type` discriminant. */
export type TokenKind = Token["type"];

const ok = <T>(value: T): DcborResult<T, never> => Object.freeze({ ok: true, value });
const err = (error: DcborParseError): DcborResult<never, DcborParseError> =>
  Object.freeze({ ok: false, error });

// Sticky regular expressions: matched at `lastIndex` without slicing the
// source, so a long document lexes in linear time.
// A date literal admits any decimal digit (`\p{Nd}`), so a non-ASCII digit
// reaches the date parser and is rejected as a date; a number is ASCII only.
const DATE_RE =
  /\p{Nd}{4}-\p{Nd}{2}-\p{Nd}{2}(?:T\p{Nd}{2}:\p{Nd}{2}:\p{Nd}{2}(?:\.\p{Nd}+)?(?:Z|[+-]\p{Nd}{2}:\p{Nd}{2})?)?/uy;
const NUMBER_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const TAG_NAME_RE = /[a-zA-Z_][a-zA-Z0-9_-]*\(/y;
// eslint-disable-next-line no-control-regex -- control characters are excluded from strings
const STRING_RE = /"([^"\\\x00-\x1F]|\\(["\\bnfrt/]|u[a-fA-F0-9]{4}))*"/y;
// A hex or base64 literal is a token only as a whole; `h'zz'` or `b64'A'`
// is text no token matches. A body that matches but does not decode (an odd
// digit count, non-canonical base64) is a token carrying its error.
const HEX_RE = /h'[0-9a-fA-F]*'/y;
const BASE64_RE = /b64'[A-Za-z0-9+/=]{2,}'/y;
const KNOWN_VALUE_NUMBER_RE = /'(0|[1-9][0-9]*)'/y;
const KNOWN_VALUE_NAME_RE = /'([a-zA-Z_][a-zA-Z0-9_-]*)'/y;
const UR_RE = /ur:([a-zA-Z0-9][a-zA-Z0-9-]*)\/([a-zA-Z]{8,})/y;

type ValuelessKind = Exclude<
  TokenKind,
  | "Bool"
  | "ByteStringHex"
  | "ByteStringBase64"
  | "DateLiteral"
  | "Number"
  | "String"
  | "TagValue"
  | "TagName"
  | "KnownValueNumber"
  | "KnownValueName"
  | "UR"
>;

/**
 * The keywords, longest first so `-Infinity` is tried before anything else
 * that starts with `-`. A keyword must not run straight into identifier
 * characters (`truex` is one unrecognised run) and must not be followed by
 * `(`, which makes it a tag name; `-Infinity` is exempt from both because no
 * identifier starts with `-`.
 */
const KEYWORDS: readonly (readonly [string, ValuelessKind | "Bool", boolean | undefined])[] = [
  ["-Infinity", "NegInfinity", undefined],
  ["true", "Bool", true],
  ["false", "Bool", false],
  ["null", "Null", undefined],
  ["NaN", "NaN", undefined],
  ["Infinity", "Infinity", undefined],
  ["Unit", "Unit", undefined],
];
const IDENT_CHAR = /[a-zA-Z0-9_-]/;
const IDENT_RUN_RE = /[a-zA-Z_][a-zA-Z0-9_-]*/y;

const PUNCTUATION: ReadonlyMap<string, ValuelessKind> = new Map<string, ValuelessKind>([
  ["{", "BraceOpen"],
  ["}", "BraceClose"],
  ["[", "BracketOpen"],
  ["]", "BracketClose"],
  ["(", "ParenthesisOpen"],
  [")", "ParenthesisClose"],
  [":", "Colon"],
  [",", "Comma"],
]);

/**
 * Splits a source string into tokens. Iterate it, or call `next()` until it
 * returns `undefined`; either way text no token matches throws
 * `DcborParseError`.
 *
 * @beta
 */
export class Lexer implements Iterable<Token> {
  private readonly _source: string;
  private _position: number;
  private _tokenStart: number;
  private _tokenEnd: number;

  constructor(source: string) {
    this._source = source;
    this._position = 0;
    this._tokenStart = 0;
    this._tokenEnd = 0;
  }

  /** The span of the last token (or of the unrecognised text that stopped the lexer). */
  get span(): Span {
    return span(this._tokenStart, this._tokenEnd);
  }

  /** The source text of the last token. */
  get slice(): string {
    return this._source.slice(this._tokenStart, this._tokenEnd);
  }

  /** The tokens, in order. */
  *[Symbol.iterator](): Iterator<Token> {
    for (let t = this.next(); t !== undefined; t = this.next()) {
      yield t;
    }
  }

  /**
   * The next token, or `undefined` at the end of the source. A literal that
   * matched its pattern but did not decode is still a token; it carries the
   * error.
   *
   * @throws {DcborParseError} for text no token matches
   */
  next(): Token | undefined {
    const skipStart = this._position;
    const unterminatedComment = this._skipWhitespaceAndComments();

    if (this._position >= this._source.length) {
      // At the end of the source the span is empty and sits at the end.
      this._tokenStart = this._position;
      this._tokenEnd = this._position;
      return undefined;
    }

    this._tokenStart = this._position;

    const result =
      this._tryMatchKeyword() ??
      this._tryMatchDateLiteral() ??
      this._tryMatchTagValueOrNumber() ??
      this._tryMatchTagName() ??
      this._tryMatchString() ??
      this._tryMatchByteStringHex() ??
      this._tryMatchByteStringBase64() ??
      this._tryMatchKnownValue() ??
      this._tryMatchUR() ??
      this._tryMatchPunctuation();

    if (result === undefined) {
      // Unrecognised text spans what a scanner reads before giving up: a
      // whitespace run that ends in an unterminated `/…` comment fails as one
      // run, from its start to the end of the source; text that starts like
      // an identifier is the whole identifier; anything else is one code point.
      if (unterminatedComment) {
        this._tokenStart = skipStart;
        this._position = this._source.length;
      } else {
        const run = this._exec(IDENT_RUN_RE);
        this._position +=
          run !== null ? run[0].length : String.fromCodePoint(this._codePoint()).length;
      }
      this._tokenEnd = this._position;
      throw DcborParseError.unrecognizedToken(this.span);
    }

    return result;
  }

  /** The code point at the current position. */
  private _codePoint(): number {
    return this._source.codePointAt(this._position) ?? 0;
  }

  /** Finishes a token at the current position. */
  private _done<T extends { readonly type: TokenKind }>(token: T): T & { readonly span: Span } {
    this._tokenEnd = this._position;
    return Object.freeze({ ...token, span: this.span });
  }

  /**
   * Skips spaces, tabs, newlines, form feeds, `/…/` comments and `#` comments
   * to the end of the line. `true` when it stopped at a `/` with no closing
   * `/`: the run is not whitespace then, and `next()` reports it as one.
   */
  private _skipWhitespaceAndComments(): boolean {
    while (this._position < this._source.length) {
      const ch = this._source[this._position];

      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f") {
        this._position++;
        continue;
      }

      // An inline comment is `/` … `/` with no `/` inside, so `//` is an
      // empty comment.
      if (ch === "/") {
        let scan = this._position + 1;
        while (scan < this._source.length && this._source[scan] !== "/") {
          scan++;
        }
        if (scan < this._source.length) {
          this._position = scan + 1;
          continue;
        }
        return true;
      }

      if (ch === "#") {
        while (this._position < this._source.length && this._source[this._position] !== "\n") {
          this._position++;
        }
        continue;
      }

      break;
    }
    return false;
  }

  private _tryMatchKeyword(): Token | undefined {
    for (const [keyword, kind, value] of KEYWORDS) {
      if (!this._source.startsWith(keyword, this._position)) continue;
      const after = this._source[this._position + keyword.length] ?? "";
      if (!keyword.startsWith("-") && (after === "(" || IDENT_CHAR.test(after))) continue;
      this._position += keyword.length;
      return kind === "Bool"
        ? this._done({ type: "Bool", value: value === true })
        : this._done({ type: kind });
    }
    return undefined;
  }

  private _tryMatchDateLiteral(): Token | undefined {
    const match = this._exec(DATE_RE);
    if (match === null) return undefined;

    const dateStr = match[0];
    this._position += dateStr.length;
    this._tokenEnd = this._position;

    // dcbor's date parser owns the grammar (nanosecond fractions, offsets,
    // the `:60` leap second, calendar validation); a rejection is
    // `InvalidDateString` over the literal.
    let value: DcborResult<CborDate, DcborParseError>;
    try {
      value = ok(CborDate.fromString(dateStr));
    } catch {
      value = err(DcborParseError.invalidDateString(dateStr, this.span));
    }
    return this._done({ type: "DateLiteral", value });
  }

  private _tryMatchTagValueOrNumber(): Token | undefined {
    const match = this._exec(NUMBER_RE);
    if (match === null) return undefined;

    const numStr = match[0];
    const nextChar = this._source[this._position + numStr.length];

    // A non-negative integer directly followed by `(` is a tag value.
    if (
      nextChar === "(" &&
      !numStr.includes(".") &&
      !numStr.includes("e") &&
      !numStr.includes("E") &&
      !numStr.startsWith("-")
    ) {
      this._position += numStr.length + 1;
      this._tokenEnd = this._position;

      const parsed = parseU64(numStr);
      const value =
        parsed !== undefined
          ? ok(parsed)
          : err(
              DcborParseError.invalidTagValue(
                numStr,
                span(this._tokenStart, this._tokenStart + numStr.length),
              ),
            );
      return this._done({ type: "TagValue", value });
    }

    this._position += numStr.length;
    return this._done({ type: "Number", value: parseFloat(numStr) });
  }

  private _tryMatchTagName(): Token | undefined {
    const match = this._exec(TAG_NAME_RE);
    if (match === null) return undefined;

    const fullMatch = match[0];
    this._position += fullMatch.length;
    return this._done({ type: "TagName", value: fullMatch.slice(0, -1) });
  }

  private _tryMatchString(): Token | undefined {
    if (this._source[this._position] !== '"') {
      return undefined;
    }

    const match = this._exec(STRING_RE);
    if (match === null) return undefined;
    const fullMatch = match[0];
    this._position += fullMatch.length;
    return this._done({ type: "String", value: fullMatch });
  }

  private _tryMatchByteStringHex(): Token | undefined {
    const match = this._exec(HEX_RE);
    if (match === null) return undefined;

    const digits = match[0].slice(2, -1);
    this._position += match[0].length;
    this._tokenEnd = this._position;

    const value =
      digits.length % 2 === 0
        ? ok(hexToBytes(digits))
        : err(DcborParseError.invalidHexString(this.span));
    return this._done({ type: "ByteStringHex", value });
  }

  private _tryMatchByteStringBase64(): Token | undefined {
    const match = this._exec(BASE64_RE);
    if (match === null) return undefined;

    const body = match[0].slice(4, -1);
    this._position += match[0].length;
    this._tokenEnd = this._position;

    const bytes = base64ToBytes(body);
    const value =
      bytes !== undefined ? ok(bytes) : err(DcborParseError.invalidBase64String(this.span));
    return this._done({ type: "ByteStringBase64", value });
  }

  private _tryMatchKnownValue(): Token | undefined {
    if (this._source[this._position] !== "'") {
      return undefined;
    }

    // `''` is the empty name.
    if (this._source[this._position + 1] === "'") {
      this._position += 2;
      return this._done({ type: "KnownValueName", value: "" });
    }

    let match = this._exec(KNOWN_VALUE_NUMBER_RE);
    if (match !== null) {
      const fullMatch = match[0];
      const numStr = match[1];
      this._position += fullMatch.length;
      this._tokenEnd = this._position;

      const parsed = parseU64(numStr);
      const value =
        parsed !== undefined
          ? ok(parsed)
          : err(
              DcborParseError.invalidKnownValue(
                numStr,
                span(this._tokenStart + 1, this._tokenEnd - 1),
              ),
            );
      return this._done({ type: "KnownValueNumber", value });
    }

    match = this._exec(KNOWN_VALUE_NAME_RE);
    if (match === null) return undefined;
    const fullMatch = match[0];
    const name = match[1];
    this._position += fullMatch.length;
    return this._done({ type: "KnownValueName", value: name });
  }

  private _tryMatchUR(): Token | undefined {
    const match = this._exec(UR_RE);
    if (match === null) return undefined;

    const fullMatch = match[0];
    this._position += fullMatch.length;
    this._tokenEnd = this._position;

    let value: DcborResult<UR, DcborParseError>;
    try {
      value = ok(UR.parse(fullMatch));
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      value = err(DcborParseError.invalidUr(cause, this.span));
    }
    return this._done({ type: "UR", value });
  }

  private _tryMatchPunctuation(): Token | undefined {
    const kind = PUNCTUATION.get(this._source[this._position]);
    if (kind === undefined) return undefined;
    this._position++;
    return this._done({ type: kind });
  }

  /** Runs a sticky regex at the current position. */
  private _exec(re: RegExp): RegExpExecArray | null {
    re.lastIndex = this._position;
    return re.exec(this._source);
  }
}

const MAX_U64 = (1n << 64n) - 1n;

/**
 * A string of decimal digits as an unsigned 64-bit integer: a `number` when
 * it fits `Number.MAX_SAFE_INTEGER`, a `bigint` above that, `undefined`
 * beyond `2⁶⁴ − 1`. The callers' regular expressions guarantee the digits.
 */
function parseU64(digits: string): number | bigint | undefined {
  if (digits.length < 16) return Number(digits);
  const value = BigInt(digits);
  if (value > MAX_U64) return undefined;
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Decodes standard base64 strictly: the length is a multiple of four, `=`
 * appears only as the last one or two characters, every other character is
 * in the alphabet, and the bits left over in the last sextet are zero.
 * `undefined` when any of that fails.
 */
function base64ToBytes(text: string): Uint8Array | undefined {
  if (text.length % 4 !== 0) return undefined;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const body = text.slice(0, text.length - padding);
  const out = new Uint8Array((text.length / 4) * 3 - padding);
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (const ch of body) {
    const v = BASE64_ALPHABET.indexOf(ch);
    if (v < 0) return undefined;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
      acc &= (1 << bits) - 1;
    }
  }
  if (bits > 0 && acc !== 0) return undefined;
  return out;
}

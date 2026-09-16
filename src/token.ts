/**
 * The tokenizer for dCBOR diagnostic notation.
 *
 * @module token
 */

import { CborDate, hexToBytes } from "@blockchaincommons/dcbor";
import { UR } from "@blockchaincommons/uniform-resources";
import { type Span, type TokenKind, span, DcborParseError } from "./error";

type Spanned<T extends { readonly type: TokenKind }> = T & {
  /** Where the token sits in the source, in UTF-16 code units. */
  readonly span: Span;
};

/**
 * A token of the notation, with its span.
 *
 * `TagValue` and `KnownValueNumber` accept the full unsigned 64-bit range:
 * a value that fits in `Number.MAX_SAFE_INTEGER` is a `number`, anything
 * larger a `bigint`, so no precision is lost. A `String` token holds the
 * text between the quotes; escape sequences are kept as written.
 */
export type Token =
  | Spanned<{ readonly type: "Bool"; readonly value: boolean }>
  | Spanned<{ readonly type: "BraceOpen" }>
  | Spanned<{ readonly type: "BraceClose" }>
  | Spanned<{ readonly type: "BracketOpen" }>
  | Spanned<{ readonly type: "BracketClose" }>
  | Spanned<{ readonly type: "ParenthesisOpen" }>
  | Spanned<{ readonly type: "ParenthesisClose" }>
  | Spanned<{ readonly type: "Colon" }>
  | Spanned<{ readonly type: "Comma" }>
  | Spanned<{ readonly type: "Null" }>
  | Spanned<{ readonly type: "NaN" }>
  | Spanned<{ readonly type: "Infinity" }>
  | Spanned<{ readonly type: "NegInfinity" }>
  | Spanned<{ readonly type: "ByteStringHex"; readonly value: Uint8Array }>
  | Spanned<{ readonly type: "ByteStringBase64"; readonly value: Uint8Array }>
  | Spanned<{ readonly type: "DateLiteral"; readonly value: CborDate }>
  | Spanned<{ readonly type: "Number"; readonly value: number }>
  | Spanned<{ readonly type: "String"; readonly value: string }>
  | Spanned<{ readonly type: "TagValue"; readonly value: number | bigint }>
  | Spanned<{ readonly type: "TagName"; readonly value: string }>
  | Spanned<{ readonly type: "KnownValueNumber"; readonly value: number | bigint }>
  | Spanned<{ readonly type: "KnownValueName"; readonly value: string }>
  | Spanned<{ readonly type: "Unit" }>
  | Spanned<{ readonly type: "UR"; readonly value: UR }>;

// Sticky regular expressions: matched at `lastIndex` without slicing the
// source, so a long document lexes in linear time.
const DATE_RE = /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/y;
const NUMBER_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const TAG_NAME_RE = /[a-zA-Z_][a-zA-Z0-9_-]*\(/y;
// eslint-disable-next-line no-control-regex -- control characters are excluded from strings
const STRING_RE = /"([^"\\\x00-\x1F]|\\(["\\bnfrt/]|u[a-fA-F0-9]{4}))*"/y;
const HEX_RE = /[0-9a-fA-F]*/y;
const BASE64_RE = /[A-Za-z0-9+/=]*/y;
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
   * The next token, or `undefined` at the end of the source.
   *
   * @throws {DcborParseError} for unrecognised text or a malformed literal
   */
  next(): Token | undefined {
    this._skipWhitespaceAndComments();

    if (this._position >= this._source.length) {
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
      // Unrecognised text: one character, so the caller can report and stop.
      this._position++;
      this._tokenEnd = this._position;
      throw DcborParseError.unrecognizedToken(this.span);
    }

    return result;
  }

  /** Finishes a token at the current position. */
  private _done<T extends { readonly type: TokenKind }>(token: T): Spanned<T> {
    this._tokenEnd = this._position;
    return Object.freeze({ ...token, span: this.span });
  }

  /** Skips spaces, tabs, newlines, form feeds, `/…/` comments and `#` comments to the end of the line. */
  private _skipWhitespaceAndComments(): void {
    while (this._position < this._source.length) {
      const ch = this._source[this._position];

      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f") {
        this._position++;
        continue;
      }

      // An inline comment is `/` … `/` with no `/` inside, so `//` is an
      // empty comment. Without a closing `/` the character is not a comment
      // and is left for the token matchers to reject.
      if (ch === "/") {
        let scan = this._position + 1;
        while (scan < this._source.length && this._source[scan] !== "/") {
          scan++;
        }
        if (scan < this._source.length) {
          this._position = scan + 1;
          continue;
        }
        break;
      }

      if (ch === "#") {
        while (this._position < this._source.length && this._source[this._position] !== "\n") {
          this._position++;
        }
        continue;
      }

      break;
    }
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
    let value: CborDate;
    try {
      value = CborDate.fromString(dateStr);
    } catch {
      throw DcborParseError.invalidDateString(dateStr, this.span);
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
      if (parsed === undefined) {
        throw DcborParseError.invalidTagValue(
          numStr,
          span(this._tokenStart, this._tokenStart + numStr.length),
        );
      }
      return this._done({ type: "TagValue", value: parsed });
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
    if (match !== null) {
      const fullMatch = match[0];
      this._position += fullMatch.length;
      return this._done({ type: "String", value: fullMatch.slice(1, -1) });
    }

    // A malformed string is unrecognised at its opening quote; the caller
    // reports and stops there.
    this._position++;
    this._tokenEnd = this._position;
    throw DcborParseError.unrecognizedToken(this.span);
  }

  private _tryMatchByteStringHex(): Token | undefined {
    if (!this._matchLiteral("h'")) {
      return undefined;
    }

    const match = this._exec(HEX_RE);
    const hexPart = match !== null ? match[0] : "";
    this._position += hexPart.length;

    if (this._source[this._position] !== "'") {
      this._tokenEnd = this._position;
      throw DcborParseError.invalidHexString(this.span);
    }
    this._position++;
    this._tokenEnd = this._position;

    if (hexPart.length % 2 !== 0) {
      throw DcborParseError.invalidHexString(this.span);
    }
    return this._done({ type: "ByteStringHex", value: hexToBytes(hexPart) });
  }

  private _tryMatchByteStringBase64(): Token | undefined {
    if (!this._matchLiteral("b64'")) {
      return undefined;
    }

    const match = this._exec(BASE64_RE);
    const base64Part = match !== null ? match[0] : "";
    this._position += base64Part.length;

    if (this._source[this._position] !== "'") {
      this._tokenEnd = this._position;
      throw DcborParseError.invalidBase64String(this.span);
    }
    this._position++;
    this._tokenEnd = this._position;

    // The literal needs at least two characters.
    const bytes = base64Part.length < 2 ? undefined : base64ToBytes(base64Part);
    if (bytes === undefined) {
      throw DcborParseError.invalidBase64String(this.span);
    }
    return this._done({ type: "ByteStringBase64", value: bytes });
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

      const value = parseU64(numStr);
      if (value === undefined) {
        throw DcborParseError.invalidKnownValue(
          numStr,
          span(this._tokenStart + 1, this._tokenEnd - 1),
        );
      }
      return this._done({ type: "KnownValueNumber", value });
    }

    match = this._exec(KNOWN_VALUE_NAME_RE);
    if (match !== null) {
      const fullMatch = match[0];
      const name = match[1];
      this._position += fullMatch.length;
      return this._done({ type: "KnownValueName", value: name });
    }

    // A malformed known value is unrecognised at its opening quote.
    this._position++;
    this._tokenEnd = this._position;
    throw DcborParseError.unrecognizedToken(this.span);
  }

  private _tryMatchUR(): Token | undefined {
    const match = this._exec(UR_RE);
    if (match === null) return undefined;

    const fullMatch = match[0];
    this._position += fullMatch.length;
    this._tokenEnd = this._position;

    let value: UR;
    try {
      value = UR.parse(fullMatch);
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      throw DcborParseError.invalidUr(cause, this.span);
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

  private _matchLiteral(literal: string): boolean {
    if (this._source.startsWith(literal, this._position)) {
      this._position += literal.length;
      return true;
    }
    return false;
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

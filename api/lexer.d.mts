import { f as Span, p as TokenKind } from "./error-BtUGgXI-.mjs";
import { CborDate } from "@blockchaincommons/dcbor";
import { UR } from "@blockchaincommons/uniform-resources";
//#region src/token.d.ts
type Spanned<T extends {
  readonly type: TokenKind;
}> = T & {
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
type Token = Spanned<{
  readonly type: "Bool";
  readonly value: boolean;
}> | Spanned<{
  readonly type: "BraceOpen";
}> | Spanned<{
  readonly type: "BraceClose";
}> | Spanned<{
  readonly type: "BracketOpen";
}> | Spanned<{
  readonly type: "BracketClose";
}> | Spanned<{
  readonly type: "ParenthesisOpen";
}> | Spanned<{
  readonly type: "ParenthesisClose";
}> | Spanned<{
  readonly type: "Colon";
}> | Spanned<{
  readonly type: "Comma";
}> | Spanned<{
  readonly type: "Null";
}> | Spanned<{
  readonly type: "NaN";
}> | Spanned<{
  readonly type: "Infinity";
}> | Spanned<{
  readonly type: "NegInfinity";
}> | Spanned<{
  readonly type: "ByteStringHex";
  readonly value: Uint8Array;
}> | Spanned<{
  readonly type: "ByteStringBase64";
  readonly value: Uint8Array;
}> | Spanned<{
  readonly type: "DateLiteral";
  readonly value: CborDate;
}> | Spanned<{
  readonly type: "Number";
  readonly value: number;
}> | Spanned<{
  readonly type: "String";
  readonly value: string;
}> | Spanned<{
  readonly type: "TagValue";
  readonly value: number | bigint;
}> | Spanned<{
  readonly type: "TagName";
  readonly value: string;
}> | Spanned<{
  readonly type: "KnownValueNumber";
  readonly value: number | bigint;
}> | Spanned<{
  readonly type: "KnownValueName";
  readonly value: string;
}> | Spanned<{
  readonly type: "Unit";
}> | Spanned<{
  readonly type: "UR";
  readonly value: UR;
}>;
/**
 * Splits a source string into tokens. Iterate it, or call `next()` until it
 * returns `undefined`; either way text no token matches throws
 * `DcborParseError`.
 *
 * @beta
 */
export declare class Lexer implements Iterable<Token> {
  private readonly _source;
  private _position;
  private _tokenStart;
  private _tokenEnd;
  constructor(source: string);
  /** The span of the last token (or of the unrecognised text that stopped the lexer). */
  get span(): Span;
  /** The source text of the last token. */
  get slice(): string;
  /** The tokens, in order. */
  [Symbol.iterator](): Iterator<Token>;
  /**
   * The next token, or `undefined` at the end of the source.
   *
   * @throws {DcborParseError} for unrecognised text or a malformed literal
   */
  next(): Token | undefined;
  /** Finishes a token at the current position. */
  private _done;
  /** Skips spaces, tabs, newlines, form feeds, `/…/` comments and `#` comments to the end of the line. */
  private _skipWhitespaceAndComments;
  private _tryMatchKeyword;
  private _tryMatchDateLiteral;
  private _tryMatchTagValueOrNumber;
  private _tryMatchTagName;
  private _tryMatchString;
  private _tryMatchByteStringHex;
  private _tryMatchByteStringBase64;
  private _tryMatchKnownValue;
  private _tryMatchUR;
  private _tryMatchPunctuation;
  /** Runs a sticky regex at the current position. */
  private _exec;
  private _matchLiteral;
}
//#endregion
export type { Token, TokenKind };
//# sourceMappingURL=lexer.d.mts.map
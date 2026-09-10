import { Cbor, CborDate } from "@blockchaincommons/dcbor-compat";
import { UR } from "@blockchaincommons/uniform-resources";
//#region src/token.d.ts
/**
 * Token types produced by the lexer.
 *
 * Corresponds to the Rust `Token` enum in token.rs.
 *
 * **u64 parity**: `TagValue` and `KnownValueNumber` are widened to
 * `number | bigint` because Rust accepts the full `u64` range
 * (`0..=2^64-1`). Values that fit in
 * {@link Number.MAX_SAFE_INTEGER} (`2^53-1`) come through as plain
 * `number`s; anything larger arrives as a `bigint` so callers don't
 * silently lose precision. This matches the way `@blockchaincommons/dcbor-compat` already
 * stores large unsigned integers (`number | bigint`) and lets the
 * downstream `cbor({ tag, value })` builder serialize correctly.
 *
 * **String value field**: the lexer keeps the outer double quotes on
 * the slice (e.g. `"\"hello\""`); the parser strips them in
 * `parseString`. Mirrors Rust `Token::String(String)` which holds the
 * raw `lex.slice()` including quotes (`token.rs:115-119`).
 */
type Token = {
  readonly type: "Bool";
  readonly value: boolean;
} | {
  readonly type: "BraceOpen";
} | {
  readonly type: "BraceClose";
} | {
  readonly type: "BracketOpen";
} | {
  readonly type: "BracketClose";
} | {
  readonly type: "ParenthesisOpen";
} | {
  readonly type: "ParenthesisClose";
} | {
  readonly type: "Colon";
} | {
  readonly type: "Comma";
} | {
  readonly type: "Null";
} | {
  readonly type: "NaN";
} | {
  readonly type: "Infinity";
} | {
  readonly type: "NegInfinity";
} | {
  readonly type: "ByteStringHex";
  readonly value: Uint8Array;
} | {
  readonly type: "ByteStringBase64";
  readonly value: Uint8Array;
} | {
  readonly type: "DateLiteral";
  readonly value: CborDate;
} | {
  readonly type: "Number";
  readonly value: number;
} | {
  readonly type: "String";
  readonly value: string;
} | {
  readonly type: "TagValue";
  readonly value: number | bigint;
} | {
  readonly type: "TagName";
  readonly value: string;
} | {
  readonly type: "KnownValueNumber";
  readonly value: number | bigint;
} | {
  readonly type: "KnownValueName";
  readonly value: string;
} | {
  readonly type: "Unit";
} | {
  readonly type: "UR";
  readonly value: UR;
};
declare const token: {
  bool(value: boolean): Token;
  braceOpen(): Token;
  braceClose(): Token;
  bracketOpen(): Token;
  bracketClose(): Token;
  parenthesisOpen(): Token;
  parenthesisClose(): Token;
  colon(): Token;
  comma(): Token;
  null(): Token;
  nan(): Token;
  infinity(): Token;
  negInfinity(): Token;
  byteStringHex(value: Uint8Array): Token;
  byteStringBase64(value: Uint8Array): Token;
  dateLiteral(value: CborDate): Token;
  number(value: number): Token;
  string(value: string): Token;
  tagValue(value: number | bigint): Token;
  tagName(value: string): Token;
  knownValueNumber(value: number | bigint): Token;
  knownValueName(value: string): Token;
  unit(): Token;
  ur(value: UR): Token;
};
/**
 * Lexer for dCBOR diagnostic notation.
 *
 * Corresponds to the Rust `logos::Lexer` used in parse.rs
 */
declare class Lexer {
  private readonly _source;
  private _position;
  private _tokenStart;
  private _tokenEnd;
  constructor(source: string);
  /**
   * Gets the current span (position range of the last token).
   */
  span(): Span;
  /**
   * Gets the slice of source corresponding to the last token.
   */
  slice(): string;
  /**
   * Gets the next token, or undefined if at end of input.
   * Returns a Result to handle lexing errors.
   */
  next(): ParseResult<Token> | undefined;
  private _skipWhitespaceAndComments;
  /**
   * Matches reserved keywords: `true`, `false`, `null`, `NaN`,
   * `Infinity`, `-Infinity`, `Unit`.
   *
   * Mirrors Rust's `Logos` `#[token(...)]` matcher
   * (`bc-dcbor-parse-rust/src/token.rs:12-50, 164`), which is greedy
   * and emits the keyword token *as soon as the literal matches* —
   * subsequent characters become a separate (likely unrecognized) token
   * stream. So input like `truex` lexes as `Bool(true)` followed by an
   * unrecognized run on `x`. Earlier revisions of this port enforced an
   * identifier boundary check (`!_isIdentifierChar(nextChar)`) and
   * rejected the whole prefix as a single `UnrecognizedToken`, which
   * broke span/variant parity with Rust.
   */
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
  private _matchLiteral;
}
//#endregion
//#region src/error.d.ts
/**
 * Represents a span (range) in the source string.
 *
 * Corresponds to the Rust `logos::Span` type.
 *
 * **Encoding caveat (TS↔Rust)**: Rust spans are *byte* offsets into the
 * UTF-8 source. JavaScript strings are UTF-16 code-unit indexed, and
 * the TS lexer reports spans in those native code-unit units. The two
 * representations agree for ASCII input. For non-BMP / multi-byte
 * input (e.g. `"🌎"`, emoji, CJK characters) the indices diverge. If
 * you need byte-exact spans across implementations, transcode the
 * source to UTF-8 first or apply the equivalent `String.length` ↔
 * UTF-8 byte length conversion at the boundary.
 */
interface Span {
  readonly start: number;
  readonly end: number;
}
/**
 * Creates a span with the given start and end positions.
 */
declare function span(start: number, end: number): Span;
/**
 * Creates a default (empty) span.
 */
declare function defaultSpan(): Span;
/**
 * Parse error types.
 *
 * Corresponds to the Rust `Error` enum in error.rs
 */
type ParseError = {
  readonly type: "EmptyInput";
} | {
  readonly type: "UnexpectedEndOfInput";
} | {
  readonly type: "ExtraData";
  readonly span: Span;
} | {
  readonly type: "UnexpectedToken";
  readonly token: Token;
  readonly span: Span;
} | {
  readonly type: "UnrecognizedToken";
  readonly span: Span;
} | {
  readonly type: "ExpectedComma";
  readonly span: Span;
} | {
  readonly type: "ExpectedColon";
  readonly span: Span;
} | {
  readonly type: "UnmatchedParentheses";
  readonly span: Span;
} | {
  readonly type: "UnmatchedBraces";
  readonly span: Span;
} | {
  readonly type: "ExpectedMapKey";
  readonly span: Span;
} | {
  readonly type: "InvalidTagValue";
  readonly value: string;
  readonly span: Span;
} | {
  readonly type: "UnknownTagName";
  readonly name: string;
  readonly span: Span;
} | {
  readonly type: "InvalidHexString";
  readonly span: Span;
} | {
  readonly type: "InvalidBase64String";
  readonly span: Span;
} | {
  readonly type: "UnknownUrType";
  readonly urType: string;
  readonly span: Span;
} | {
  readonly type: "InvalidUr";
  readonly message: string;
  readonly span: Span;
} | {
  readonly type: "InvalidKnownValue";
  readonly value: string;
  readonly span: Span;
} | {
  readonly type: "UnknownKnownValueName";
  readonly name: string;
  readonly span: Span;
} | {
  readonly type: "InvalidDateString";
  readonly dateString: string;
  readonly span: Span;
} | {
  readonly type: "DuplicateMapKey";
  readonly span: Span;
};
declare const parseError: {
  emptyInput(): ParseError;
  unexpectedEndOfInput(): ParseError;
  extraData(span: Span): ParseError;
  unexpectedToken(token: Token, span: Span): ParseError;
  unrecognizedToken(span: Span): ParseError;
  expectedComma(span: Span): ParseError;
  expectedColon(span: Span): ParseError;
  unmatchedParentheses(span: Span): ParseError;
  unmatchedBraces(span: Span): ParseError;
  expectedMapKey(span: Span): ParseError;
  invalidTagValue(value: string, span: Span): ParseError;
  unknownTagName(name: string, span: Span): ParseError;
  invalidHexString(span: Span): ParseError;
  invalidBase64String(span: Span): ParseError;
  unknownUrType(urType: string, span: Span): ParseError;
  invalidUr(message: string, span: Span): ParseError;
  invalidKnownValue(value: string, span: Span): ParseError;
  unknownKnownValueName(name: string, span: Span): ParseError;
  invalidDateString(dateString: string, span: Span): ParseError;
  duplicateMapKey(span: Span): ParseError;
};
/**
 * Checks if an error is the default unrecognized token error.
 *
 * Corresponds to Rust `Error::is_default()`
 */
declare function isDefaultError(error: ParseError): boolean;
/**
 * Gets the error message for a parse error.
 *
 * Corresponds to Rust's `Display` implementation for `Error`
 */
declare function errorMessage(error: ParseError): string;
/**
 * Gets the span for a parse error, if applicable.
 */
declare function errorSpan(error: ParseError): Span | undefined;
/**
 * Gets the full error message with source context.
 *
 * Corresponds to Rust `Error::full_message()`
 */
declare function fullErrorMessage(error: ParseError, source: string): string;
/**
 * Creates a default parse error (UnrecognizedToken with empty span).
 *
 * Corresponds to Rust `Error::default()`
 */
declare function defaultParseError(): ParseError;
/**
 * Result type for parse operations.
 *
 * Corresponds to Rust `Result<T, Error>`
 */
type ParseResult<T> = {
  readonly ok: true;
  readonly value: T;
} | {
  readonly ok: false;
  readonly error: ParseError;
};
/**
 * Creates a successful result.
 */
declare function ok<T>(value: T): ParseResult<T>;
/**
 * Creates an error result.
 */
declare function err<T>(error: ParseError): ParseResult<T>;
/**
 * Checks if a result is successful.
 */
declare function isOk<T>(result: ParseResult<T>): result is {
  ok: true;
  value: T;
};
/**
 * Checks if a result is an error.
 */
declare function isErr<T>(result: ParseResult<T>): result is {
  ok: false;
  error: ParseError;
};
/**
 * Unwraps a result, throwing if it's an error.
 */
declare function unwrap<T>(result: ParseResult<T>): T;
/**
 * Unwraps a result error, throwing if it's successful.
 */
declare function unwrapErr<T>(result: ParseResult<T>): ParseError;
//#endregion
//#region src/parse.d.ts
/**
 * Parses a dCBOR item from a string input.
 *
 * This function takes a string slice containing a dCBOR diagnostic notation
 * encoded value and attempts to parse it into a `Cbor` object. If the input
 * contains extra tokens after a valid item, an error is returned.
 *
 * @param src - A string containing the dCBOR-encoded data.
 * @returns `Ok(Cbor)` if parsing is successful and the input contains exactly one
 *   valid dCBOR item, which itself might be an atomic value like a number or
 *   string, or a complex value like an array or map.
 *   `Err(ParseError)` if parsing fails or if extra tokens are found after the item.
 *
 * @example
 * ```typescript
 * const result = parseDcborItem("[1, 2, 3]");
 * if (result.ok) {
 *   console.log(result.value.toDiagnostic()); // "[1, 2, 3]"
 * }
 * ```
 */
declare function parseDcborItem(src: string): ParseResult<Cbor>;
/**
 * Parses a dCBOR item from the beginning of a string and returns the parsed
 * `Cbor` along with the number of bytes consumed.
 *
 * Unlike `parseDcborItem`, this function succeeds even if additional
 * characters follow the first item. The returned index points to the first
 * unparsed character after skipping any trailing whitespace or comments.
 *
 * @param src - A string containing the dCBOR-encoded data.
 * @returns `Ok([Cbor, number])` with the parsed item and bytes consumed.
 *
 * @example
 * ```typescript
 * const result = parseDcborItemPartial("true )");
 * if (result.ok) {
 *   const [cbor, used] = result.value;
 *   console.log(cbor.toDiagnostic()); // "true"
 *   console.log(used); // 5
 * }
 * ```
 */
declare function parseDcborItemPartial(src: string): ParseResult<[Cbor, number]>;
//#endregion
//#region src/compose.d.ts
/**
 * Compose error types.
 *
 * Corresponds to the Rust `Error` enum in compose.rs
 */
type ComposeError = {
  readonly type: "OddMapLength";
} | {
  readonly type: "DuplicateMapKey";
} | {
  readonly type: "ParseError";
  readonly error: ParseError;
};
declare const composeError: {
  oddMapLength(): ComposeError;
  duplicateMapKey(): ComposeError;
  parseError(error: ParseError): ComposeError;
};
/**
 * Gets the error message for a compose error.
 *
 * Mirrors Rust `Error::Display` (`bc-dcbor-parse-rust/src/compose.rs`):
 * the `ParseError` arm uses `#[error("Invalid CBOR item: {0}")]`, which
 * formats the inner error via its `Display` impl — *not* the variant
 * name. So `Error::ParseError(Error::EmptyInput)` formats as
 * `"Invalid CBOR item: Empty input"`, not
 * `"Invalid CBOR item: EmptyInput"`. We delegate to {@link errorMessage}
 * to get the same `Display`-style text.
 */
declare function composeErrorMessage(error: ComposeError): string;
/**
 * Result type for compose operations.
 *
 * Corresponds to Rust `Result<T, Error>`
 */
type ComposeResult<T> = {
  readonly ok: true;
  readonly value: T;
} | {
  readonly ok: false;
  readonly error: ComposeError;
};
/**
 * Creates a successful compose result.
 */
declare function composeOk<T>(value: T): ComposeResult<T>;
/**
 * Creates an error compose result.
 */
declare function composeErr<T>(error: ComposeError): ComposeResult<T>;
/**
 * Composes a dCBOR array from a slice of string slices, and returns a CBOR
 * object representing the array.
 *
 * Each string slice is parsed as a dCBOR item.
 *
 * @param array - Array of strings, each representing a dCBOR item
 * @returns A CBOR array containing all parsed items
 *
 * @example
 * ```typescript
 * const result = composeDcborArray(["1", "2", "3"]);
 * if (result.ok) {
 *   console.log(result.value.toDiagnostic()); // "[1, 2, 3]"
 * }
 * ```
 */
declare function composeDcborArray(array: readonly string[]): ComposeResult<Cbor>;
/**
 * Composes a dCBOR map from a slice of string slices, and returns a CBOR
 * object representing the map.
 *
 * The length of the slice must be even, as each key must have a corresponding
 * value.
 *
 * Each string slice is parsed as a dCBOR item.
 *
 * @param array - Array of strings representing key-value pairs in alternating order
 * @returns A CBOR map containing all parsed key-value pairs
 *
 * @example
 * ```typescript
 * const result = composeDcborMap(["1", "2", "3", "4"]);
 * if (result.ok) {
 *   console.log(result.value.toDiagnostic()); // "{1: 2, 3: 4}"
 * }
 * ```
 */
declare function composeDcborMap(array: readonly string[]): ComposeResult<Cbor>;
//#endregion
export { type ComposeError, type ComposeResult, Lexer, type ParseError, type ParseResult, type Span, type Token, composeDcborArray, composeDcborMap, composeErr, composeError, composeErrorMessage, composeOk, defaultParseError, defaultSpan, err, errorMessage, errorSpan, fullErrorMessage, isDefaultError, isErr, isOk, ok, parseDcborItem, parseDcborItemPartial, parseError, span, token, unwrap, unwrapErr };
//# sourceMappingURL=index.d.mts.map
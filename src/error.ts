/**
 * Errors: `DcborParseError` for text that does not parse, `DcborComposeError`
 * for compose calls. Spans are UTF-16 code-unit offsets into the source.
 */
import type { Token } from "./token";

/** A non-throwing outcome: the value, or the error. */
export type DcborResult<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** A half-open range of UTF-16 code units in the source string. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/** Builds a span. */
export function span(start: number, end: number): Span {
  return { start, end };
}

/** Converts a span's UTF-16 offsets to UTF-8 byte offsets (the reference implementation's unit). */
export function spanToByteOffsets(source: string, s: Span): Span {
  const bytes = (n: number): number => new TextEncoder().encode(source.slice(0, n)).length;
  return { start: bytes(s.start), end: bytes(s.end) };
}

/** Why a source string was rejected. */
export const DcborParseErrorCode = {
  EmptyInput: "EmptyInput",
  UnexpectedEndOfInput: "UnexpectedEndOfInput",
  ExtraData: "ExtraData",
  UnexpectedToken: "UnexpectedToken",
  UnrecognizedToken: "UnrecognizedToken",
  ExpectedComma: "ExpectedComma",
  ExpectedColon: "ExpectedColon",
  UnmatchedParentheses: "UnmatchedParentheses",
  UnmatchedBraces: "UnmatchedBraces",
  ExpectedMapKey: "ExpectedMapKey",
  InvalidTagValue: "InvalidTagValue",
  UnknownTagName: "UnknownTagName",
  InvalidHexString: "InvalidHexString",
  InvalidBase64String: "InvalidBase64String",
  UnknownUrType: "UnknownUrType",
  InvalidUr: "InvalidUr",
  InvalidKnownValue: "InvalidKnownValue",
  UnknownKnownValueName: "UnknownKnownValueName",
  InvalidDateString: "InvalidDateString",
  DuplicateMapKey: "DuplicateMapKey",
} as const;

/** One of the `DcborParseErrorCode` values. */
export type DcborParseErrorCode = (typeof DcborParseErrorCode)[keyof typeof DcborParseErrorCode];

/** What a `DcborParseError` carries besides its code; every field is code-specific. */
export interface DcborParseErrorDetails {
  /** Where in the source (absent for `EmptyInput` and `UnexpectedEndOfInput`). */
  readonly span?: Span;
  /** `UnexpectedToken`: the token found. */
  readonly token?: Token;
  /** `InvalidTagValue`, `InvalidKnownValue`: the offending text. */
  readonly value?: string;
  /** `UnknownTagName`, `UnknownKnownValueName`: the name that did not resolve. */
  readonly name?: string;
  /** `UnknownUrType`: the UR type that did not resolve. */
  readonly urType?: string;
  /** `InvalidUr`: the UR decoder's message. */
  readonly message?: string;
  /** `InvalidDateString`: the text. */
  readonly dateString?: string;
}

/** Thrown by `parseDcbor` and friends. */
export class DcborParseError extends Error {
  readonly code: DcborParseErrorCode;
  readonly details: DcborParseErrorDetails;

  constructor(code: DcborParseErrorCode, message: string, details: DcborParseErrorDetails = {}) {
    super(message);
    this.name = "DcborParseError";
    this.code = code;
    this.details = details;
  }

  static isDcborParseError(e: unknown): e is DcborParseError {
    return e instanceof DcborParseError;
  }

  /** The span, if the error has one. */
  get span(): Span | undefined {
    return this.details.span;
  }

  /** The message with the source line and a caret under the span. */
  fullMessage(source: string): string {
    const s =
      this.code === "UnexpectedEndOfInput"
        ? span(source.length, source.length)
        : (this.details.span ?? span(0, 0));
    return formatMessage(this.message, source, s);
  }

  static emptyInput(): DcborParseError {
    return new DcborParseError("EmptyInput", "Empty input");
  }
  static unexpectedEndOfInput(): DcborParseError {
    return new DcborParseError("UnexpectedEndOfInput", "Unexpected end of input");
  }
  static extraData(span: Span): DcborParseError {
    return new DcborParseError("ExtraData", "Extra data at end of input", { span });
  }
  static unexpectedToken(token: Token, span: Span): DcborParseError {
    return new DcborParseError("UnexpectedToken", `Unexpected token ${tokenDebugString(token)}`, {
      token,
      span,
    });
  }
  static unrecognizedToken(span: Span): DcborParseError {
    return new DcborParseError("UnrecognizedToken", "Unrecognized token", { span });
  }
  static expectedComma(span: Span): DcborParseError {
    return new DcborParseError("ExpectedComma", "Expected comma", { span });
  }
  static expectedColon(span: Span): DcborParseError {
    return new DcborParseError("ExpectedColon", "Expected colon", { span });
  }
  static unmatchedParentheses(span: Span): DcborParseError {
    return new DcborParseError("UnmatchedParentheses", "Unmatched parentheses", { span });
  }
  static unmatchedBraces(span: Span): DcborParseError {
    return new DcborParseError("UnmatchedBraces", "Unmatched braces", { span });
  }
  static expectedMapKey(span: Span): DcborParseError {
    return new DcborParseError("ExpectedMapKey", "Expected map key", { span });
  }
  static invalidTagValue(value: string, span: Span): DcborParseError {
    return new DcborParseError("InvalidTagValue", `Invalid tag value '${value}'`, { value, span });
  }
  static unknownTagName(name: string, span: Span): DcborParseError {
    return new DcborParseError("UnknownTagName", `Unknown tag name '${name}'`, { name, span });
  }
  static invalidHexString(span: Span): DcborParseError {
    return new DcborParseError("InvalidHexString", "Invalid hex string", { span });
  }
  static invalidBase64String(span: Span): DcborParseError {
    return new DcborParseError("InvalidBase64String", "Invalid base64 string", { span });
  }
  static unknownUrType(urType: string, span: Span): DcborParseError {
    return new DcborParseError("UnknownUrType", `Unknown UR type '${urType}'`, { urType, span });
  }
  static invalidUr(message: string, span: Span): DcborParseError {
    return new DcborParseError("InvalidUr", `Invalid UR '${message}'`, { message, span });
  }
  static invalidKnownValue(value: string, span: Span): DcborParseError {
    return new DcborParseError("InvalidKnownValue", `Invalid known value '${value}'`, {
      value,
      span,
    });
  }
  static unknownKnownValueName(name: string, span: Span): DcborParseError {
    return new DcborParseError("UnknownKnownValueName", `Unknown known value name '${name}'`, {
      name,
      span,
    });
  }
  static invalidDateString(dateString: string, span: Span): DcborParseError {
    return new DcborParseError("InvalidDateString", `Invalid date string '${dateString}'`, {
      dateString,
      span,
    });
  }
  static duplicateMapKey(span: Span): DcborParseError {
    return new DcborParseError("DuplicateMapKey", "Duplicate map key", { span });
  }
}

/** Why a compose call was rejected. */
export const DcborComposeErrorCode = {
  OddMapLength: "OddMapLength",
  DuplicateMapKey: "DuplicateMapKey",
  /** An item did not parse; the `DcborParseError` is the `cause`. */
  ParseError: "ParseError",
} as const;

/** One of the `DcborComposeErrorCode` values. */
export type DcborComposeErrorCode =
  (typeof DcborComposeErrorCode)[keyof typeof DcborComposeErrorCode];

/** Thrown by `composeDcborArray` and `composeDcborMap`. */
export class DcborComposeError extends Error {
  readonly code: DcborComposeErrorCode;
  declare readonly cause?: DcborParseError;

  constructor(code: DcborComposeErrorCode, message: string, cause?: DcborParseError) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "DcborComposeError";
    this.code = code;
  }

  static isDcborComposeError(e: unknown): e is DcborComposeError {
    return e instanceof DcborComposeError;
  }

  static oddMapLength(): DcborComposeError {
    return new DcborComposeError("OddMapLength", "Invalid odd map length");
  }
  static duplicateMapKey(): DcborComposeError {
    return new DcborComposeError("DuplicateMapKey", "Duplicate map key");
  }
  static parseError(cause: DcborParseError): DcborComposeError {
    return new DcborComposeError("ParseError", `Invalid CBOR item: ${cause.message}`, cause);
  }
}

function formatMessage(message: string, source: string, range: Span): string {
  const start = range.start;
  const end = range.end;
  let lineNumber = 1;
  let lineStart = 0;
  for (let idx = 0; idx < source.length && idx < start; idx++) {
    if (source[idx] === "\n") {
      lineNumber++;
      lineStart = idx + 1;
    }
  }
  const lines = source.split("\n");
  let line = lines[lineNumber - 1] ?? "";
  if (line.endsWith("\r")) {
    line = line.slice(0, -1);
  }
  const column = Math.max(0, start - lineStart);
  const underlineLen = Math.max(1, end - start);
  const caret = " ".repeat(column) + "^".repeat(underlineLen);
  return `line ${lineNumber}: ${message}\n${line}\n${caret}`;
}
function tokenDebugString(token: Token): string {
  switch (token.type) {
    case "Bool":
      return `Bool(${token.value ? "true" : "false"})`;
    case "BraceOpen":
      return "BraceOpen";
    case "BraceClose":
      return "BraceClose";
    case "BracketOpen":
      return "BracketOpen";
    case "BracketClose":
      return "BracketClose";
    case "ParenthesisOpen":
      return "ParenthesisOpen";
    case "ParenthesisClose":
      return "ParenthesisClose";
    case "Colon":
      return "Colon";
    case "Comma":
      return "Comma";
    case "Null":
      return "Null";
    case "NaN":
      return "NaN";
    case "Infinity":
      return "Infinity";
    case "NegInfinity":
      return "NegInfinity";
    case "Unit":
      return "Unit";
    case "ByteStringHex":
      // Rust `Token::ByteStringHex(Result<Vec<u8>>)` debug-formats the
      // `Ok(Vec<u8>)` payload as `Ok([0x68, 0x65, ...])`. We render the
      // bytes in the same `[0xNN, ...]` form so the text matches.
      return `ByteStringHex(Ok(${formatBytesDebug(token.value)}))`;
    case "ByteStringBase64":
      return `ByteStringBase64(Ok(${formatBytesDebug(token.value)}))`;
    case "DateLiteral":
      // The Rust `Date` `Debug` impl is opaque; we delegate to the
      // CborDate's own string rendering, which is the closest TS gets.
      return `DateLiteral(Ok(${String(token.value)}))`;
    case "Number":
      return `Number(${formatNumberDebug(token.value)})`;
    case "String":
      // The lexer stores the slice including the outer quotes
      // (matching Rust `Token::String(String)` which holds the raw
      // `lex.slice()`). Rust's `Debug` impl on `String` re-quotes the
      // contents — so a token whose value is `"hello"` prints as
      // `String("\"hello\"")`. Since the inner already contains the
      // quotes, we can mirror Rust by `JSON.stringify`-ing.
      return `String(${JSON.stringify(token.value)})`;
    case "TagValue":
      return `TagValue(Ok(${tagOrKnownValueDebug(token.value)}))`;
    case "TagName":
      return `TagName(${JSON.stringify(token.value)})`;
    case "KnownValueNumber":
      return `KnownValueNumber(Ok(${tagOrKnownValueDebug(token.value)}))`;
    case "KnownValueName":
      return `KnownValueName(${JSON.stringify(token.value)})`;
    case "UR":
      // Rust `Token::UR(Result<UR>)` → `UR(Ok(<UR debug>))`. We don't
      // have access to the Rust `UR::Debug` shape, so we emit the UR
      // string form, which is stable and unambiguous.
      return `UR(Ok(${token.value.toString()}))`;
  }
}

/**
 * Renders a `Vec<u8>` the way Rust's `Debug` does:
 * `[0x68, 0x65, 0x6c, 0x6c, 0x6f]`.
 */
function formatBytesDebug(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (const b of bytes) {
    parts.push(`0x${b.toString(16).padStart(2, "0")}`);
  }
  return `[${parts.join(", ")}]`;
}

/**
 * Renders a JS `number` the way Rust's `f64::Debug` typically prints
 * it — using a decimal point even for integral values (e.g. `42.0`),
 * and `inf` / `-inf` / `NaN` for non-finite numbers. The dCBOR-parse
 * Rust source rarely produces a `Number` token in error messages
 * (numbers normally land in tagged-content contexts), but we still
 * mirror the convention so any error text is consistent with Rust.
 */
function formatNumberDebug(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "inf" : "-inf";
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
}

/**
 * Renders a `u64` payload the way Rust's `Debug` does — a bare digit
 * sequence without trailing `n` for `bigint` values. Mirrors
 * `<u64 as Debug>::fmt` and `<TagValue as Debug>::fmt` (TagValue is a
 * type alias for u64 in `bc-ur` / `dcbor`).
 */
function tagOrKnownValueDebug(value: number | bigint): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

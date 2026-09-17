/**
 * Errors: `DcborParseError` for text that does not parse, `DcborComposeError`
 * for compose calls. Spans are UTF-16 code-unit offsets into the source.
 *
 * @module error
 */
import type { Token } from "./token";

/** A non-throwing outcome: the value, or the error. */
export type DcborResult<T, E> =
  | {
      /** `true`: `value` is present. */
      readonly ok: true;
      /** The outcome. */
      readonly value: T;
    }
  | {
      /** `false`: `error` is present. */
      readonly ok: false;
      /** Why there is no value. */
      readonly error: E;
    };

/** A half-open range of UTF-16 code units in the source string. */
export interface Span {
  /** The offset of the first code unit. */
  readonly start: number;
  /** The offset after the last code unit. */
  readonly end: number;
}

/** Builds a frozen span. */
export function span(start: number, end: number): Span {
  return Object.freeze({ start, end });
}

const utf8 = new TextEncoder();

/** Converts a span's UTF-16 offsets to UTF-8 byte offsets (the reference implementation's unit). */
export function spanToByteOffsets(source: string, span: Span): Span {
  const bytes = (n: number): number => utf8.encode(source.slice(0, n)).length;
  return Object.freeze({ start: bytes(span.start), end: bytes(span.end) });
}

/** Why a source string was rejected. */
export const DcborParseErrorCode: {
  /** The source holds nothing but whitespace and comments. */
  readonly EmptyInput: "EmptyInput";
  /** The source ended inside an item. */
  readonly UnexpectedEndOfInput: "UnexpectedEndOfInput";
  /** Text follows the first item. */
  readonly ExtraData: "ExtraData";
  /** A token that cannot start or continue an item here; inside an array also `Unit` and a literal that did not decode. */
  readonly UnexpectedToken: "UnexpectedToken";
  /** Text no token matches. */
  readonly UnrecognizedToken: "UnrecognizedToken";
  /** Two items in a container with nothing between them. */
  readonly ExpectedComma: "ExpectedComma";
  /** A map key not followed by a colon. */
  readonly ExpectedColon: "ExpectedColon";
  /** A tag's content not followed by `)`. */
  readonly UnmatchedParentheses: "UnmatchedParentheses";
  /** A map not closed before the end of the source. */
  readonly UnmatchedBraces: "UnmatchedBraces";
  /** A map entry without a value. */
  readonly ExpectedMapKey: "ExpectedMapKey";
  /** A tag number outside the unsigned 64-bit range. */
  readonly InvalidTagValue: "InvalidTagValue";
  /** A tag name the tags store does not know. */
  readonly UnknownTagName: "UnknownTagName";
  /** An `h'…'` literal with an odd number of digits. */
  readonly InvalidHexString: "InvalidHexString";
  /** A `b64'…'` literal that is not canonical base64. */
  readonly InvalidBase64String: "InvalidBase64String";
  /** A UR whose type has no tag in the tags store. */
  readonly UnknownUrType: "UnknownUrType";
  /** A UR the decoder rejects. */
  readonly InvalidUr: "InvalidUr";
  /** A known-value number outside the unsigned 64-bit range. */
  readonly InvalidKnownValue: "InvalidKnownValue";
  /** A known-value name the registry does not know. */
  readonly UnknownKnownValueName: "UnknownKnownValueName";
  /** A date literal that is not a valid instant. */
  readonly InvalidDateString: "InvalidDateString";
  /** A map key that appears twice. */
  readonly DuplicateMapKey: "DuplicateMapKey";
  /** Nesting deeper than `ParseOptions.maxDepth`; this package's own limit. */
  readonly NestingTooDeep: "NestingTooDeep";
} = Object.freeze({
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
  NestingTooDeep: "NestingTooDeep",
});

/** One of the `DcborParseErrorCode` values. */
export type DcborParseErrorCode = (typeof DcborParseErrorCode)[keyof typeof DcborParseErrorCode];

/**
 * The structured payload of a {@link DcborParseError}, discriminated by
 * `code`: `e.details.code === "UnknownTagName"` narrows to `{ span, name }`.
 * Every code but `EmptyInput` and `UnexpectedEndOfInput` carries the span
 * of the offending text.
 */
export type DcborParseErrorDetails =
  | {
      /** The discriminant. */
      readonly code: "EmptyInput";
    }
  | {
      /** The discriminant. */
      readonly code: "UnexpectedEndOfInput";
    }
  | {
      /** The discriminant. */
      readonly code: "ExtraData";
      /** The first token past the item. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "UnexpectedToken";
      /** The token. */
      readonly span: Span;
      /** The token found, with its payload (a literal's decoded value or its own error). */
      readonly token: Token;
    }
  | {
      /** The discriminant. */
      readonly code: "UnrecognizedToken";
      /** The token before the unrecognised text (an empty span at the start of the source). */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "ExpectedComma";
      /** The token found instead. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "ExpectedColon";
      /** The token found instead, or the key when the source ended. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "UnmatchedParentheses";
      /** The token found instead of `)`, or the last token when the source ended. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "UnmatchedBraces";
      /** The last token before the source ended. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "ExpectedMapKey";
      /** The `}` found where a value was expected. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidTagValue";
      /** The digits. */
      readonly span: Span;
      /** The digits as written. */
      readonly value: string;
    }
  | {
      /** The discriminant. */
      readonly code: "UnknownTagName";
      /** The name. */
      readonly span: Span;
      /** The name that did not resolve. */
      readonly name: string;
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidHexString";
      /** The literal. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidBase64String";
      /** The literal. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "UnknownUrType";
      /** The type inside the UR. */
      readonly span: Span;
      /** The UR type that did not resolve. */
      readonly urType: string;
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidUr";
      /** The UR. */
      readonly span: Span;
      /** The UR decoder's reason. */
      readonly cause: string;
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidKnownValue";
      /** The digits inside the quotes. */
      readonly span: Span;
      /** The digits as written. */
      readonly value: string;
    }
  | {
      /** The discriminant. */
      readonly code: "UnknownKnownValueName";
      /** The name inside the quotes. */
      readonly span: Span;
      /** The name that did not resolve. */
      readonly name: string;
    }
  | {
      /** The discriminant. */
      readonly code: "InvalidDateString";
      /** The literal. */
      readonly span: Span;
      /** The literal as written. */
      readonly dateString: string;
    }
  | {
      /** The discriminant. */
      readonly code: "DuplicateMapKey";
      /** The second occurrence of the key. */
      readonly span: Span;
    }
  | {
      /** The discriminant. */
      readonly code: "NestingTooDeep";
      /** The token that opened the level too many. */
      readonly span: Span;
      /** The limit in force. */
      readonly maxDepth: number;
    };

/** The details payload of each `DcborParseErrorCode`. */
export type DcborParseErrorDetailsByCode = {
  [D in DcborParseErrorDetails as D["code"]]: D;
};

/**
 * A {@link DcborParseError} narrowed to one code: `code` is `C` and `details`
 * is the payload of `C`. With the default type argument it is the union over
 * every code, so narrowing on `error.code` narrows `error.details`.
 */
export type DcborParseErrorTyped<C extends DcborParseErrorCode = DcborParseErrorCode> =
  C extends DcborParseErrorCode
    ? DcborParseError & {
        /** The discriminant. */
        readonly code: C;
        /** The payload of `code`. */
        readonly details: DcborParseErrorDetailsByCode[C];
      }
    : never;

/**
 * Thrown by `parseDcborItem` and `parseDcborItemPartial` (and carried by the `try…`
 * forms) for text that does not parse. `code` says why; `details` carries
 * the span and the code-specific fields; `fullMessage(source)` renders the
 * message with the source line and a caret. Instances come from the static
 * factories only.
 *
 * @example
 * ```ts
 * try {
 *   parseDcborItem(text);
 * } catch (e) {
 *   if (DcborParseError.isDcborParseError(e) && e.code === "UnknownTagName") {
 *     e.details.name; // the tag name that did not resolve
 *   }
 * }
 * ```
 */
export class DcborParseError extends Error {
  /** Always `"DcborParseError"`; the cross-copy identity {@link DcborParseError.isDcborParseError} checks. */
  override readonly name = "DcborParseError";
  /** The discriminant; equals `details.code`. */
  readonly code: DcborParseErrorCode;
  /** The structured payload, discriminated by `code`. */
  readonly details: DcborParseErrorDetails;

  private constructor(message: string, details: DcborParseErrorDetails) {
    super(message);
    this.code = details.code;
    this.details = Object.freeze(details);
  }

  /** Type guard for a `DcborParseError`, including one from another copy of this package. */
  static isDcborParseError(value: unknown): value is DcborParseErrorTyped {
    return value instanceof Error && value.name === "DcborParseError" && "code" in value;
  }

  /** `true` when `code` is this error's code. */
  is(code: DcborParseErrorCode): boolean {
    return this.code === code;
  }

  /** The span, if the error has one. */
  get span(): Span | undefined {
    return "span" in this.details ? this.details.span : undefined;
  }

  /** The message with the source line and a caret under the span. */
  fullMessage(source: string): string {
    const s =
      this.code === "UnexpectedEndOfInput"
        ? span(source.length, source.length)
        : (this.span ?? span(0, 0));
    return formatMessage(this.message, source, s);
  }

  private static make<C extends DcborParseErrorCode>(
    message: string,
    details: DcborParseErrorDetailsByCode[C],
  ): DcborParseErrorTyped<C> {
    return new DcborParseError(message, details) as DcborParseErrorTyped<C>;
  }

  /** The source holds nothing but whitespace and comments. */
  static emptyInput(): DcborParseErrorTyped<"EmptyInput"> {
    return DcborParseError.make("Empty input", { code: "EmptyInput" });
  }
  /** The source ended inside an item. */
  static unexpectedEndOfInput(): DcborParseErrorTyped<"UnexpectedEndOfInput"> {
    return DcborParseError.make("Unexpected end of input", { code: "UnexpectedEndOfInput" });
  }
  /** Text follows the first item. */
  static extraData(span: Span): DcborParseErrorTyped<"ExtraData"> {
    return DcborParseError.make("Extra data at end of input", { code: "ExtraData", span });
  }
  /** A token that cannot start or continue an item here; `text` is its source text. */
  static unexpectedToken(token: Token, text: string): DcborParseErrorTyped<"UnexpectedToken"> {
    return DcborParseError.make(`Unexpected token \`${text}\``, {
      code: "UnexpectedToken",
      span: token.span,
      token,
    });
  }
  /** Text no token matches. */
  static unrecognizedToken(span: Span): DcborParseErrorTyped<"UnrecognizedToken"> {
    return DcborParseError.make("Unrecognized token", { code: "UnrecognizedToken", span });
  }
  /** Two items in a container with nothing between them. */
  static expectedComma(span: Span): DcborParseErrorTyped<"ExpectedComma"> {
    return DcborParseError.make("Expected comma", { code: "ExpectedComma", span });
  }
  /** A map key not followed by a colon. */
  static expectedColon(span: Span): DcborParseErrorTyped<"ExpectedColon"> {
    return DcborParseError.make("Expected colon", { code: "ExpectedColon", span });
  }
  /** A tag's content not followed by `)`. */
  static unmatchedParentheses(span: Span): DcborParseErrorTyped<"UnmatchedParentheses"> {
    return DcborParseError.make("Unmatched parentheses", { code: "UnmatchedParentheses", span });
  }
  /** A map not closed before the end of the source. */
  static unmatchedBraces(span: Span): DcborParseErrorTyped<"UnmatchedBraces"> {
    return DcborParseError.make("Unmatched braces", { code: "UnmatchedBraces", span });
  }
  /** A map entry without a value. */
  static expectedMapKey(span: Span): DcborParseErrorTyped<"ExpectedMapKey"> {
    return DcborParseError.make("Expected map key", { code: "ExpectedMapKey", span });
  }
  /** A tag number outside the unsigned 64-bit range. */
  static invalidTagValue(value: string, span: Span): DcborParseErrorTyped<"InvalidTagValue"> {
    return DcborParseError.make(`Invalid tag value '${value}'`, {
      code: "InvalidTagValue",
      span,
      value,
    });
  }
  /** A tag name the tags store does not know. */
  static unknownTagName(name: string, span: Span): DcborParseErrorTyped<"UnknownTagName"> {
    return DcborParseError.make(`Unknown tag name '${name}'`, {
      code: "UnknownTagName",
      span,
      name,
    });
  }
  /** An `h'…'` literal with an odd number of digits. */
  static invalidHexString(span: Span): DcborParseErrorTyped<"InvalidHexString"> {
    return DcborParseError.make("Invalid hex string", { code: "InvalidHexString", span });
  }
  /** A `b64'…'` literal that is not canonical base64. */
  static invalidBase64String(span: Span): DcborParseErrorTyped<"InvalidBase64String"> {
    return DcborParseError.make("Invalid base64 string", { code: "InvalidBase64String", span });
  }
  /** A UR whose type has no tag in the tags store. */
  static unknownUrType(urType: string, span: Span): DcborParseErrorTyped<"UnknownUrType"> {
    return DcborParseError.make(`Unknown UR type '${urType}'`, {
      code: "UnknownUrType",
      span,
      urType,
    });
  }
  /** A UR the decoder rejects. */
  static invalidUr(cause: string, span: Span): DcborParseErrorTyped<"InvalidUr"> {
    return DcborParseError.make(`Invalid UR '${cause}'`, { code: "InvalidUr", span, cause });
  }
  /** A known-value number outside the unsigned 64-bit range. */
  static invalidKnownValue(value: string, span: Span): DcborParseErrorTyped<"InvalidKnownValue"> {
    return DcborParseError.make(`Invalid known value '${value}'`, {
      code: "InvalidKnownValue",
      span,
      value,
    });
  }
  /** A known-value name the registry does not know. */
  static unknownKnownValueName(
    name: string,
    span: Span,
  ): DcborParseErrorTyped<"UnknownKnownValueName"> {
    return DcborParseError.make(`Unknown known value name '${name}'`, {
      code: "UnknownKnownValueName",
      span,
      name,
    });
  }
  /** A date literal that is not a valid instant. */
  static invalidDateString(
    dateString: string,
    span: Span,
  ): DcborParseErrorTyped<"InvalidDateString"> {
    return DcborParseError.make(`Invalid date string '${dateString}'`, {
      code: "InvalidDateString",
      span,
      dateString,
    });
  }
  /** A map key that appears twice. */
  static duplicateMapKey(span: Span): DcborParseErrorTyped<"DuplicateMapKey"> {
    return DcborParseError.make("Duplicate map key", { code: "DuplicateMapKey", span });
  }
  /** A container or tag nested deeper than `maxDepth`. */
  static nestingTooDeep(maxDepth: number, span: Span): DcborParseErrorTyped<"NestingTooDeep"> {
    return DcborParseError.make(`Nesting deeper than ${maxDepth} levels`, {
      code: "NestingTooDeep",
      span,
      maxDepth,
    });
  }
}

/** Why a compose call was rejected. */
export const DcborComposeErrorCode: {
  /** A map needs an even number of items. */
  readonly OddMapLength: "OddMapLength";
  /** A map key that appears twice. */
  readonly DuplicateMapKey: "DuplicateMapKey";
  /** An item did not parse; the `DcborParseError` is the `cause`. */
  readonly ParseError: "ParseError";
} = Object.freeze({
  OddMapLength: "OddMapLength",
  DuplicateMapKey: "DuplicateMapKey",
  ParseError: "ParseError",
});

/** One of the `DcborComposeErrorCode` values. */
export type DcborComposeErrorCode =
  (typeof DcborComposeErrorCode)[keyof typeof DcborComposeErrorCode];

/** The structured payload of a {@link DcborComposeError}, discriminated by `code`. */
export type DcborComposeErrorDetails =
  | {
      /** The discriminant. */
      readonly code: "OddMapLength";
    }
  | {
      /** The discriminant. */
      readonly code: "DuplicateMapKey";
    }
  | {
      /** The discriminant. */
      readonly code: "ParseError";
      /** The item's error. */
      readonly cause: DcborParseError;
    };

/** The details payload of each `DcborComposeErrorCode`. */
export type DcborComposeErrorDetailsByCode = {
  [D in DcborComposeErrorDetails as D["code"]]: D;
};

/** A {@link DcborComposeError} narrowed to one code. */
export type DcborComposeErrorTyped<C extends DcborComposeErrorCode = DcborComposeErrorCode> =
  C extends DcborComposeErrorCode
    ? DcborComposeError & {
        /** The discriminant. */
        readonly code: C;
        /** The payload of `code`. */
        readonly details: DcborComposeErrorDetailsByCode[C];
      }
    : never;

/**
 * Thrown by `composeDcborArray` and `composeDcborMap` (and carried by the
 * `try…` forms). A `ParseError` carries the item's `DcborParseError` as
 * `cause` and in `details.cause`. Instances come from the static factories only.
 */
export class DcborComposeError extends Error {
  /** Always `"DcborComposeError"`; the cross-copy identity {@link DcborComposeError.isDcborComposeError} checks. */
  override readonly name = "DcborComposeError";
  /** The discriminant; equals `details.code`. */
  readonly code: DcborComposeErrorCode;
  /** The structured payload, discriminated by `code`. */
  readonly details: DcborComposeErrorDetails;
  /** The item's error, for a `ParseError`. */
  declare readonly cause?: DcborParseError;

  private constructor(message: string, details: DcborComposeErrorDetails) {
    super(message, details.code === "ParseError" ? { cause: details.cause } : undefined);
    this.code = details.code;
    this.details = Object.freeze(details);
  }

  /** Type guard for a `DcborComposeError`, including one from another copy of this package. */
  static isDcborComposeError(value: unknown): value is DcborComposeErrorTyped {
    return value instanceof Error && value.name === "DcborComposeError" && "code" in value;
  }

  /** `true` when `code` is this error's code. */
  is(code: DcborComposeErrorCode): boolean {
    return this.code === code;
  }

  private static make<C extends DcborComposeErrorCode>(
    message: string,
    details: DcborComposeErrorDetailsByCode[C],
  ): DcborComposeErrorTyped<C> {
    return new DcborComposeError(message, details) as DcborComposeErrorTyped<C>;
  }

  /** A map needs an even number of items. */
  static oddMapLength(): DcborComposeErrorTyped<"OddMapLength"> {
    return DcborComposeError.make("Invalid odd map length", { code: "OddMapLength" });
  }
  /** A map key that appears twice. */
  static duplicateMapKey(): DcborComposeErrorTyped<"DuplicateMapKey"> {
    return DcborComposeError.make("Duplicate map key", { code: "DuplicateMapKey" });
  }
  /** An item did not parse. */
  static parseError(cause: DcborParseError): DcborComposeErrorTyped<"ParseError"> {
    return DcborComposeError.make(`Invalid CBOR item: ${cause.message}`, {
      code: "ParseError",
      cause,
    });
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

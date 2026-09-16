import { a as DcborComposeErrorTyped, c as DcborParseErrorDetails, d as DcborResult, f as Span, h as spanToByteOffsets, i as DcborComposeErrorDetailsByCode, l as DcborParseErrorDetailsByCode, m as span, n as DcborComposeErrorCode, o as DcborParseError, p as TokenKind, r as DcborComposeErrorDetails, s as DcborParseErrorCode, t as DcborComposeError, u as DcborParseErrorTyped } from "./error-BtUGgXI-.mjs";
import { Cbor, ReadonlyTagsStore } from "@blockchaincommons/dcbor";
import { KnownValue } from "@blockchaincommons/known-values";
//#region src/parse.d.ts
/** Where known-value names resolve; a `KnownValuesStore` satisfies it. */
interface KnownValueResolver {
  /** The known value registered under `name`, or `undefined`. */
  byName(name: string): KnownValue | undefined;
}
/** How names resolve and how deep an item may nest; every field has a default. */
interface ParseOptions {
  /** Where tag names and UR types resolve; the global tags store by default. */
  readonly tags?: ReadonlyTagsStore | undefined;
  /** Where known-value names resolve; the global known-values store by default. */
  readonly knownValues?: KnownValueResolver | undefined;
  /** The deepest nesting of arrays, maps and tags accepted (a positive integer), 1 000 by default. */
  readonly maxDepth?: number | undefined;
}
/** A parsed prefix: the item and how many UTF-16 code units of the source it took. */
interface ParsedPrefix {
  /** The first item of the source. */
  readonly value: Cbor;
  /** The number of UTF-16 code units consumed, trailing whitespace and comments included. */
  readonly length: number;
}
/**
 * Parses one dCBOR item from `src`, which must contain nothing else but
 * whitespace and comments.
 *
 * @throws {DcborParseError} for text that does not parse
 * @throws {TypeError} for a `src` that is not a string or an option of the wrong type
 */
export declare function parseDcbor(src: string, options?: ParseOptions): Cbor;
/**
 * `parseDcbor` as a `Result` instead of a throw. Every string is an outcome;
 * a `src` that is not a string or an option of the wrong type still throws
 * `TypeError`.
 */
export declare function tryParseDcbor(src: string, options?: ParseOptions): DcborResult<Cbor, DcborParseError>;
/**
 * Parses the first dCBOR item of `src` and reports how much of the source
 * it consumed, leaving the rest for the caller.
 *
 * @throws {DcborParseError} for text that does not parse
 * @throws {TypeError} for a `src` that is not a string or an option of the wrong type
 */
export declare function parseDcborPrefix(src: string, options?: ParseOptions): ParsedPrefix;
/** `parseDcborPrefix` as a `Result` instead of a throw; the `TypeError` contract of `tryParseDcbor` applies. */
export declare function tryParseDcborPrefix(src: string, options?: ParseOptions): DcborResult<ParsedPrefix, DcborParseError>;
//#endregion
//#region src/compose.d.ts
/**
 * An array whose elements are the parsed `items`.
 *
 * @throws {DcborComposeError} `ParseError` with the item's error as `cause`
 * @throws {TypeError} for `items` that is not an array of strings or an option of the wrong type
 */
export declare function composeDcborArray(items: readonly string[], options?: ParseOptions): Cbor;
/**
 * A map from alternating key and value `items`.
 *
 * @throws {DcborComposeError} `OddMapLength`, `DuplicateMapKey`, or `ParseError`
 * @throws {TypeError} for `items` that is not an array of strings or an option of the wrong type
 */
export declare function composeDcborMap(items: readonly string[], options?: ParseOptions): Cbor;
/** `composeDcborArray` as a `Result` instead of a throw; a `TypeError` still throws. */
export declare function tryComposeDcborArray(items: readonly string[], options?: ParseOptions): DcborResult<Cbor, DcborComposeError>;
/** `composeDcborMap` as a `Result` instead of a throw; a `TypeError` still throws. */
export declare function tryComposeDcborMap(items: readonly string[], options?: ParseOptions): DcborResult<Cbor, DcborComposeError>;
//#endregion
export { DcborComposeError, DcborComposeErrorCode, type DcborComposeErrorDetails, type DcborComposeErrorDetailsByCode, type DcborComposeErrorTyped, DcborParseError, DcborParseErrorCode, type DcborParseErrorDetails, type DcborParseErrorDetailsByCode, type DcborParseErrorTyped, type DcborResult, type KnownValueResolver, type ParseOptions, type ParsedPrefix, type Span, type TokenKind, span, spanToByteOffsets };
//# sourceMappingURL=index.d.mts.map
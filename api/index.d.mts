import { a as DcborParseErrorDetails, c as span, i as DcborParseErrorCode, l as spanToByteOffsets, n as DcborComposeErrorCode, o as DcborResult, r as DcborParseError, s as Span, t as DcborComposeError } from "./error-DnsjqrZb.mjs";
import { Cbor, ReadonlyTagsStore } from "@blockchaincommons/dcbor";
import { KnownValuesStore } from "@blockchaincommons/known-values";
//#region src/parse.d.ts
/** Where tag names and known-value names resolve; the global stores by default. */
interface ParseOptions {
  tags?: ReadonlyTagsStore;
  knownValues?: KnownValuesStore;
}
/** A parsed prefix: the item and how many UTF-16 code units of the source it took. */
interface ParsedPrefix {
  readonly value: Cbor;
  readonly length: number;
}
/**
 * Parses one dCBOR item from `src`, which must contain nothing else but
 * whitespace and comments.
 *
 * @throws {DcborParseError}
 */
declare function parseDcbor(src: string, options?: ParseOptions): Cbor;
/** `parseDcbor` as a `Result` instead of a throw. */
declare function tryParseDcbor(src: string, options?: ParseOptions): DcborResult<Cbor, DcborParseError>;
/**
 * Parses the first dCBOR item of `src` and reports how much of the source
 * it consumed, leaving the rest for the caller.
 *
 * @throws {DcborParseError}
 */
declare function parseDcborPrefix(src: string, options?: ParseOptions): ParsedPrefix;
/** `parseDcborPrefix` as a `Result` instead of a throw. */
declare function tryParseDcborPrefix(src: string, options?: ParseOptions): DcborResult<ParsedPrefix, DcborParseError>;
//#endregion
//#region src/compose.d.ts
/**
 * An array whose elements are the parsed `items`.
 *
 * @throws {DcborComposeError} `ParseError` with the item's error as `cause`
 */
declare function composeDcborArray(items: readonly string[], options?: ParseOptions): Cbor;
/**
 * A map from alternating key and value `items`.
 *
 * @throws {DcborComposeError} `OddMapLength`, `DuplicateMapKey`, or `ParseError`
 */
declare function composeDcborMap(items: readonly string[], options?: ParseOptions): Cbor;
/** `composeDcborArray` as a `Result` instead of a throw. */
declare function tryComposeDcborArray(items: readonly string[], options?: ParseOptions): DcborResult<Cbor, DcborComposeError>;
/** `composeDcborMap` as a `Result` instead of a throw. */
declare function tryComposeDcborMap(items: readonly string[], options?: ParseOptions): DcborResult<Cbor, DcborComposeError>;
//#endregion
export { DcborComposeError, DcborComposeErrorCode, DcborParseError, DcborParseErrorCode, type DcborParseErrorDetails, type DcborResult, type ParseOptions, type ParsedPrefix, type Span, composeDcborArray, composeDcborMap, parseDcbor, parseDcborPrefix, span, spanToByteOffsets, tryComposeDcborArray, tryComposeDcborMap, tryParseDcbor, tryParseDcborPrefix };
//# sourceMappingURL=index.d.mts.map
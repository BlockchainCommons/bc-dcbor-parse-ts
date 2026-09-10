/**
 * dCBOR diagnostic notation → CBOR: `parseDcbor("[1, h'ff', 'isA', date(2023-01-01)]")`.
 *
 * @module
 */
export {
  parseDcbor,
  tryParseDcbor,
  parseDcborPrefix,
  tryParseDcborPrefix,
  type ParseOptions,
  type ParsedPrefix,
} from "./parse";
export {
  composeDcborArray,
  composeDcborMap,
  tryComposeDcborArray,
  tryComposeDcborMap,
} from "./compose";
export {
  DcborParseError,
  DcborParseErrorCode,
  type DcborParseErrorDetails,
  DcborComposeError,
  DcborComposeErrorCode,
  type Span,
  type DcborResult,
  span,
  spanToByteOffsets,
} from "./error";

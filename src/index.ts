/**
 * dCBOR diagnostic notation → CBOR: `parseDcbor("[1, h'ff', 'isA', date(2023-01-01)]")`.
 *
 * - **Parse:** `parseDcbor(src, options?)` returns a `Cbor` or throws
 *   `DcborParseError`; `tryParseDcbor` returns `{ ok, value } | { ok, error }`
 *   instead. `parseDcborPrefix`/`tryParseDcborPrefix` parse the first item
 *   and report how much source it took.
 * - **Compose:** `composeDcborArray(items, options?)` and
 *   `composeDcborMap(items, options?)` parse each item; `DcborComposeError`
 *   wraps an item's error as `cause`.
 * - **Options:** `tags` and `knownValues` choose where names resolve (the
 *   global stores by default); `maxDepth` bounds nesting (1 000).
 * - **Errors:** `code` says why, `details` is typed by `code`,
 *   `fullMessage(source)` draws a caret. Arguments of the wrong type throw
 *   `TypeError`.
 * - **Lexer:** `@blockchaincommons/dcbor-parse/lexer` (beta).
 *
 * @packageDocumentation
 */
export {
  parseDcbor,
  tryParseDcbor,
  parseDcborPrefix,
  tryParseDcborPrefix,
  type ParseOptions,
  type ParsedPrefix,
  type KnownValueResolver,
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
  type DcborParseErrorDetailsByCode,
  type DcborParseErrorTyped,
  DcborComposeError,
  DcborComposeErrorCode,
  type DcborComposeErrorDetails,
  type DcborComposeErrorDetailsByCode,
  type DcborComposeErrorTyped,
  type Span,
  type TokenKind,
  type DcborResult,
  span,
  spanToByteOffsets,
} from "./error";

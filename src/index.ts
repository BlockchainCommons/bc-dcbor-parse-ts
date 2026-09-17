/**
 * dCBOR diagnostic notation → CBOR: `parseDcborItem("[1, h'ff', 'isA', date(2023-01-01)]")`.
 *
 * - **Parse:** `parseDcborItem(src, options?)` returns a `Cbor` or throws
 *   `DcborParseError`; `tryParseDcborItem` returns `{ ok, value } | { ok, error }`
 *   instead. `parseDcborItemPartial`/`tryParseDcborItemPartial` parse the first item
 *   and report how much source it took.
 * - **Compose:** `composeDcborArray(items, options?)` and
 *   `composeDcborMap(items, options?)` parse each item; `DcborComposeError`
 *   wraps an item's error as `cause`.
 * - **Options:** `tags` and `knownValues` choose where names resolve (the
 *   global stores by default); `maxDepth` bounds nesting (1 000).
 * - **Errors:** `code` says why, `details` is typed by `code` (an
 *   `UnexpectedToken` carries the `Token`), `fullMessage(source)` draws a
 *   caret. Arguments of the wrong type throw `TypeError`.
 * - **Lexer:** `@blockchaincommons/dcbor-parse/lexer` (beta).
 *
 * @packageDocumentation
 */
export {
  parseDcborItem,
  tryParseDcborItem,
  parseDcborItemPartial,
  tryParseDcborItemPartial,
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
  type DcborResult,
  span,
  spanToByteOffsets,
} from "./error";
export type { Token, TokenKind } from "./token";

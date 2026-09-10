/**
 * Composing arrays and maps from already-textual items.
 */
import { type Cbor, cbor, CborMap } from "@blockchaincommons/dcbor";
import { DcborParseError, DcborComposeError, type DcborResult } from "./error";
import { parseDcbor, type ParseOptions } from "./parse";

function parseItem(text: string, options: ParseOptions): Cbor {
  try {
    return parseDcbor(text, options);
  } catch (e) {
    if (DcborParseError.isDcborParseError(e)) throw DcborComposeError.parseError(e);
    throw e;
  }
}

/**
 * An array whose elements are the parsed `items`.
 *
 * @throws {DcborComposeError} `ParseError` with the item's error as `cause`
 */
export function composeDcborArray(items: readonly string[], options: ParseOptions = {}): Cbor {
  return cbor(items.map((item) => parseItem(item, options)));
}

/**
 * A map from alternating key and value `items`.
 *
 * @throws {DcborComposeError} `OddMapLength`, `DuplicateMapKey`, or `ParseError`
 */
export function composeDcborMap(items: readonly string[], options: ParseOptions = {}): Cbor {
  if (items.length % 2 !== 0) {
    throw DcborComposeError.oddMapLength();
  }
  const map = new CborMap();
  for (let i = 0; i < items.length; i += 2) {
    const key = parseItem(items[i], options);
    const value = parseItem(items[i + 1], options);
    if (map.has(key)) {
      throw DcborComposeError.duplicateMapKey();
    }
    map.set(key, value);
  }
  return cbor(map);
}

const asResult = (fn: () => Cbor): DcborResult<Cbor, DcborComposeError> => {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    if (DcborComposeError.isDcborComposeError(e)) return { ok: false, error: e };
    throw e;
  }
};

/** `composeDcborArray` as a `Result` instead of a throw. */
export function tryComposeDcborArray(
  items: readonly string[],
  options: ParseOptions = {},
): DcborResult<Cbor, DcborComposeError> {
  return asResult(() => composeDcborArray(items, options));
}

/** `composeDcborMap` as a `Result` instead of a throw. */
export function tryComposeDcborMap(
  items: readonly string[],
  options: ParseOptions = {},
): DcborResult<Cbor, DcborComposeError> {
  return asResult(() => composeDcborMap(items, options));
}

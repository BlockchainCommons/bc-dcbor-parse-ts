/**
 * Composing arrays and maps from already-textual items.
 */
import { type Cbor, cbor, CborMap } from "@blockchaincommons/dcbor";
import { DcborParseError, DcborComposeError, type DcborResult } from "./error";
import { parseWith, resolveOptions, type ParseOptions } from "./parse";

function requireItems(fn: string, items: unknown): asserts items is readonly string[] {
  if (!Array.isArray(items) || !items.every((item) => typeof item === "string")) {
    throw new TypeError(`${fn}: items must be an array of strings`);
  }
}

function parseItem(text: string, ctx: ReturnType<typeof resolveOptions>): Cbor {
  try {
    return parseWith(text, ctx);
  } catch (e) {
    if (DcborParseError.isDcborParseError(e)) throw DcborComposeError.parseError(e);
    throw e;
  }
}

/**
 * An array whose elements are the parsed `items`.
 *
 * @throws {DcborComposeError} `ParseError` with the item's error as `cause`
 * @throws {TypeError} for `items` that is not an array of strings or an option of the wrong type
 */
export function composeDcborArray(items: readonly string[], options?: ParseOptions): Cbor {
  requireItems("composeDcborArray", items);
  const ctx = resolveOptions("composeDcborArray", options);
  return cbor(items.map((item) => parseItem(item, ctx)));
}

/**
 * A map from alternating key and value `items`.
 *
 * @throws {DcborComposeError} `OddMapLength`, `DuplicateMapKey`, or `ParseError`
 * @throws {TypeError} for `items` that is not an array of strings or an option of the wrong type
 */
export function composeDcborMap(items: readonly string[], options?: ParseOptions): Cbor {
  requireItems("composeDcborMap", items);
  const ctx = resolveOptions("composeDcborMap", options);
  if (items.length % 2 !== 0) {
    throw DcborComposeError.oddMapLength();
  }
  const map = new CborMap();
  for (let i = 0; i < items.length; i += 2) {
    const key = parseItem(items[i], ctx);
    const value = parseItem(items[i + 1], ctx);
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

/** `composeDcborArray` as a `Result` instead of a throw; a `TypeError` still throws. */
export function tryComposeDcborArray(
  items: readonly string[],
  options?: ParseOptions,
): DcborResult<Cbor, DcborComposeError> {
  return asResult(() => composeDcborArray(items, options));
}

/** `composeDcborMap` as a `Result` instead of a throw; a `TypeError` still throws. */
export function tryComposeDcborMap(
  items: readonly string[],
  options?: ParseOptions,
): DcborResult<Cbor, DcborComposeError> {
  return asResult(() => composeDcborMap(items, options));
}

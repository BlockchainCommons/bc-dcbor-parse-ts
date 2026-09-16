/**
 * JavaScript-only inputs: values the reference's types cannot express. Each
 * case calls the current surface with one such value; the recipe kind
 * `domain` names a key of this table.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const DOMAIN_CASES: Record<string, (m: any) => unknown> = {
  "src-undefined": (m) => m.parseDcbor(undefined),
  "src-null": (m) => m.parseDcbor(null),
  "src-number": (m) => m.parseDcbor(123),
  "src-array": (m) => m.parseDcbor(["1"]),
  "try-src-undefined": (m) => m.tryParseDcbor(undefined),
  "prefix-src-number": (m) => m.parseDcborPrefix(1),
  "try-prefix-src-undefined": (m) => m.tryParseDcborPrefix(undefined),
  "options-null": (m) => m.parseDcbor("1", null),
  "options-number": (m) => m.parseDcbor("1", 5),
  "options-string": (m) => m.parseDcbor("1", "tags"),
  "tags-number": (m) => m.parseDcbor("date(1)", { tags: 5 }),
  "tags-empty-object": (m) => m.parseDcbor("date(1)", { tags: {} }),
  "known-values-empty-object": (m) => m.parseDcbor("'isA'", { knownValues: {} }),
  "known-values-resolver": (m) =>
    m.parseDcbor("'isA'", { knownValues: { byName: () => undefined } }),
  "unit-through-resolver": (m) => m.parseDcbor("''", { knownValues: { byName: () => undefined } }),
  "max-depth-zero": (m) => m.parseDcbor("1", { maxDepth: 0 }),
  "max-depth-string": (m) => m.parseDcbor("1", { maxDepth: "9" }),
  "max-depth-fraction": (m) => m.parseDcbor("1", { maxDepth: 1.5 }),
  "max-depth-two": (m) => m.parseDcbor("[[1]]", { maxDepth: 2 }),
  "max-depth-two-exceeded": (m) => m.parseDcbor("[[[1]]]", { maxDepth: 2 }),
  "compose-items-string": (m) => m.composeDcborArray("1"),
  "compose-items-number-element": (m) => m.composeDcborArray([1]),
  "compose-map-items-null": (m) => m.composeDcborMap(null),
  "try-compose-items-string": (m) => m.tryComposeDcborArray("1"),
};

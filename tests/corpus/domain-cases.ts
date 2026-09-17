/**
 * JavaScript-only inputs: values the reference's types cannot express. Each
 * case calls the current surface with one such value; the recipe kind
 * `domain` names a key of this table.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const DOMAIN_CASES: Record<string, (m: any) => unknown> = {
  "src-undefined": (m) => m.parseDcborItem(undefined),
  "src-null": (m) => m.parseDcborItem(null),
  "src-number": (m) => m.parseDcborItem(123),
  "src-array": (m) => m.parseDcborItem(["1"]),
  "try-src-undefined": (m) => m.tryParseDcborItem(undefined),
  "partial-src-number": (m) => m.parseDcborItemPartial(1),
  "try-partial-src-undefined": (m) => m.tryParseDcborItemPartial(undefined),
  "options-null": (m) => m.parseDcborItem("1", null),
  "options-number": (m) => m.parseDcborItem("1", 5),
  "options-string": (m) => m.parseDcborItem("1", "tags"),
  "tags-number": (m) => m.parseDcborItem("date(1)", { tags: 5 }),
  "tags-empty-object": (m) => m.parseDcborItem("date(1)", { tags: {} }),
  "known-values-empty-object": (m) => m.parseDcborItem("'isA'", { knownValues: {} }),
  "known-values-resolver": (m) =>
    m.parseDcborItem("'isA'", { knownValues: { byName: () => undefined } }),
  "unit-through-resolver": (m) =>
    m.parseDcborItem("''", { knownValues: { byName: () => undefined } }),
  "max-depth-zero": (m) => m.parseDcborItem("1", { maxDepth: 0 }),
  "max-depth-string": (m) => m.parseDcborItem("1", { maxDepth: "9" }),
  "max-depth-fraction": (m) => m.parseDcborItem("1", { maxDepth: 1.5 }),
  "max-depth-two": (m) => m.parseDcborItem("[[1]]", { maxDepth: 2 }),
  "max-depth-two-exceeded": (m) => m.parseDcborItem("[[[1]]]", { maxDepth: 2 }),
  "compose-items-string": (m) => m.composeDcborArray("1"),
  "compose-items-number-element": (m) => m.composeDcborArray([1]),
  "compose-map-items-null": (m) => m.composeDcborMap(null),
  "try-compose-items-string": (m) => m.tryComposeDcborArray("1"),
};

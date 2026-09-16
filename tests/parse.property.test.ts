/**
 * Round-trip properties: diagnostic notation of generated CBOR parses back
 * to the same bytes; compose agrees with parse; the prefix parser consumes
 * exactly the item.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { cbor, encodeCbor, taggedValue, CborMap } from "@blockchaincommons/dcbor";
import { diagnostic } from "@blockchaincommons/dcbor/diagnostic";
import * as src from "../src";
import { adapterFor, hex } from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";

const api = adapterFor(src, currentDeps);

// Numbers stay within the safe-integer range: the notation lexes every number
// as a float64 (as the reference does), so larger integers round through the
// notation in both implementations. Strings avoid `"` and `\`: escapes are
// lexed but kept verbatim, again as the reference does.
const leaf = fc.oneof(
  fc.integer(),
  fc.bigInt({ min: -(2n ** 53n) + 1n, max: 2n ** 53n - 1n }),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
  fc
    .string({ maxLength: 12 })
    .filter((s) => s.normalize("NFC") === s && !s.includes('"') && !s.includes("\\")),
  fc.uint8Array({ maxLength: 8 }),
);
const value: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: "small", maxDepth: 3 },
    leaf,
    fc.array(tie("value"), { maxLength: 4 }),
    fc.integer({ min: 0, max: 60000 }).chain((tag) => tie("value").map((v) => ({ tag, v }))),
    fc.array(fc.tuple(leaf, tie("value")), { maxLength: 3 }).map((entries) => new Map(entries)),
  ),
})).value;

const toCbor = (v: unknown): ReturnType<typeof cbor> => {
  if (v !== null && typeof v === "object" && "tag" in v && "v" in v)
    return taggedValue((v as { tag: number }).tag, toCbor((v as { v: unknown }).v));
  if (Array.isArray(v)) return cbor(v.map(toCbor));
  if (v instanceof Map) {
    const m = new CborMap();
    for (const [k, val] of v) m.set(toCbor(k), toCbor(val));
    return cbor(m);
  }
  return cbor(v as never);
};

describe("dcbor-parse properties", () => {
  it("parse(diagnostic(v)) re-encodes byte-identically", () => {
    fc.assert(
      fc.property(value, (v) => {
        const c = toCbor(v);
        const text = diagnostic(c);
        expect(hex(api.parse(text))).toBe(hex(encodeCbor(c)));
      }),
      { numRuns: 300 },
    );
  });

  it("composeDcborArray(items) equals parse([items])", () => {
    fc.assert(
      fc.property(fc.array(value, { maxLength: 4 }), (vs) => {
        const items = vs.map((v) => diagnostic(toCbor(v)));
        expect(hex(api.composeArray(items))).toBe(hex(api.parse(`[${items.join(", ")}]`)));
      }),
      { numRuns: 100 },
    );
  });

  it("the prefix parser consumes exactly the item", () => {
    fc.assert(
      fc.property(value, fc.constantFrom(" ]", ", 2", " }", " x", ""), (v, tail) => {
        const text = diagnostic(toCbor(v));
        const [bytes, consumed] = api.partial(text + tail);
        expect(hex(bytes)).toBe(hex(api.parse(text)));
        expect(consumed).toBe(
          tail === "" ? text.length : text.length + (tail.startsWith(" ") ? 1 : 0),
        );
      }),
      { numRuns: 200 },
    );
  });
});

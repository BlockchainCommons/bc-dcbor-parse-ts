/**
 * Differential: every corpus recipe is parsed with the frozen bundle of the
 * previous surface AND the working tree; bytes, error variants and spans
 * must be identical outside the enumerated tombstones. Recipes the frozen
 * surface cannot express (the `domain` rows) are skipped.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import * as frozenMod from "./baseline/dcbor-parse-baseline.mjs";
import * as src from "../src";
import {
  materialize,
  frozenAdapterFor,
  adapterFor,
  recipeName,
  isBaselineSupported,
  type Recipe,
} from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const FROZEN_SHA256 = readFileSync(join(here, "baseline/README.md"), "utf8").match(
  /Baseline sha256: ([0-9a-f]{64})/,
)?.[1];

const sourceOf = (r: Recipe): string => ("src" in r ? r.src : "");
const variantOf = (outcome: string): string =>
  outcome.replace(/^throw:(Compose:ParseError:)?/, "").split("@")[0];
const spanOf = (outcome: string): [number, number] | undefined => {
  const m = /@(\d+)-(\d+)$/.exec(outcome);
  return m === null ? undefined : [Number(m[1]), Number(m[2])];
};
const LITERAL_ERRORS = /^Invalid(HexString|Base64String|DateString|Ur|TagValue|KnownValue)$/;
const sameVariant = (a: string, b: string): boolean =>
  a.startsWith("throw:") && b.startsWith("throw:") && variantOf(a) === variantOf(b);
const LITERAL_TOKENS =
  /^UnexpectedToken\((ByteStringHex|ByteStringBase64|DateLiteral|UR|TagValue|KnownValueNumber)\)$/;
const depthOf = (s: string): number => {
  let depth = 0;
  let max = 0;
  for (const c of s) {
    if (c === "[" || c === "{" || c === "(") max = Math.max(max, ++depth);
    else if (c === "]" || c === "}" || c === ")") depth--;
  }
  return max;
};

/**
 * Tombstones: the only allowed differences, each a fix towards the reference
 * or a JavaScript-only limit. `rows` pins how many corpus rows each one
 * covers once it has landed; a tombstone that has not landed must cover none.
 */
const TOMBSTONES: {
  id: string;
  landed: boolean;
  rows: number;
  matches: (r: Recipe, frozenOutcome: string, currentOutcome: string) => boolean;
}[] = [
  {
    // Fractional seconds beyond milliseconds were truncated (a JS Date); the
    // date is whole seconds + nanoseconds, as the reference computes it.
    id: "fractional-seconds",
    landed: true,
    rows: 15,
    matches: (r, a, b) =>
      /T\d\d:\d\d:\d\d\.\d{4,}/.test(sourceOf(r)) &&
      !a.startsWith("throw") &&
      !b.startsWith("throw"),
  },
  {
    // A `:60` leap second was rejected; it is second 59 plus one second, as the reference does.
    id: "leap-second",
    landed: true,
    rows: 5,
    matches: (r, a, b) =>
      /:60(\.\d+)?(Z|[+-])/.test(sourceOf(r)) &&
      a.startsWith("throw:InvalidDateString") &&
      !b.startsWith("throw"),
  },
  {
    // A keyword running straight into identifier characters (`truex`) lexed
    // as the keyword plus junk; it is unrecognised as a whole, as the reference does.
    id: "keyword-runs",
    landed: true,
    rows: 36,
    matches: (r, _a, b) =>
      /(true|false|null|NaN|Infinity|Unit)[a-zA-Z0-9_-]/.test(sourceOf(r)) &&
      b.startsWith("throw:UnrecognizedToken"),
  },
  {
    // Years 0000–0099 were rejected (a JS Date calendar probe); they encode as themselves.
    id: "years-below-100",
    landed: true,
    rows: 4,
    matches: (r, a, b) =>
      /^00\d\d-/.test(sourceOf(r)) &&
      a.startsWith("throw:InvalidDateString") &&
      !b.startsWith("throw"),
  },
  {
    // The bundled known-values registry named codepoints the reference's store
    // does not (`value`, `Self`, and a name the registry has since dropped);
    // they are unknown now, as in the reference.
    id: "registry-names",
    landed: true,
    rows: 3,
    matches: (r, a, b) =>
      /^'(value|Self|testWorkflowEntry)'$/.test(sourceOf(r)) &&
      !a.startsWith("throw") &&
      b.startsWith("throw:UnknownKnownValueName"),
  },
  {
    // Base64 with non-zero trailing bits decoded; the reference's decoder
    // rejects it (inside an array, as the token it did not decode).
    id: "base64-trailing-bits",
    landed: true,
    rows: 5,
    matches: (r, a, b) =>
      sourceOf(r).includes("b64'") &&
      !a.startsWith("throw") &&
      (variantOf(b) === "InvalidBase64String" ||
        variantOf(b) === "UnexpectedToken(ByteStringBase64)"),
  },
  {
    // A keyword directly followed by `(` lexed as the keyword (then `ExtraData`);
    // it is a tag name, as the reference's longest match makes it.
    id: "keyword-before-paren",
    landed: true,
    rows: 18,
    matches: (r, a, b) =>
      /^(true|false|null|NaN|Infinity|Unit)\(/.test(sourceOf(r)) &&
      (a.startsWith("throw:ExtraData") || !a.startsWith("throw")) &&
      (b.startsWith("throw:UnknownTagName") || b.startsWith("throw:UnexpectedEndOfInput")),
  },
  {
    // Nesting past `maxDepth` overflowed the stack (a `RangeError`) or parsed;
    // it is `NestingTooDeep`, a JavaScript-only limit.
    id: "nesting-limit",
    landed: true,
    rows: 5,
    matches: (r, _a, b) => depthOf(sourceOf(r)) > 1000 && b.startsWith("throw:NestingTooDeep"),
  },
  {
    // `Unit` inside an array parsed as the unit value; it is `UnexpectedToken`, as the reference's array grammar makes it.
    id: "unit-in-array",
    landed: true,
    rows: 116,
    matches: (_r, _a, b) => variantOf(b) === "UnexpectedToken(Unit)",
  },
  {
    // A literal that did not decode inside an array was its own error; it is
    // `UnexpectedToken` carrying the token (`ExpectedComma` or
    // `UnmatchedParentheses` where those are awaited), as the reference does.
    id: "array-literal-errors",
    landed: true,
    rows: 54,
    matches: (_r, a, b) =>
      LITERAL_ERRORS.test(variantOf(a)) &&
      (LITERAL_TOKENS.test(variantOf(b)) ||
        variantOf(b) === "ExpectedComma" ||
        variantOf(b) === "UnmatchedParentheses"),
  },
  {
    // An unknown known-value name inside an array spanned the name; it spans
    // the quotes, as the reference's array grammar reports it.
    id: "array-known-value-span",
    landed: true,
    rows: 53,
    matches: (_r, a, b) => {
      if (variantOf(a) !== "UnknownKnownValueName" || variantOf(b) !== "UnknownKnownValueName")
        return false;
      const sa = spanOf(a);
      const sb = spanOf(b);
      return sa !== undefined && sb !== undefined && sb[0] === sa[0] - 1 && sb[1] === sa[1] + 1;
    },
  },
  {
    // A hex or base64 literal that fails its pattern was its own error over
    // the literal; it is no token at all, `UnrecognizedToken` at the previous token.
    id: "literal-pattern-miss",
    landed: true,
    rows: 521,
    matches: (_r, a, b) =>
      /^Invalid(HexString|Base64String)$/.test(variantOf(a)) &&
      variantOf(b) === "UnrecognizedToken",
  },
  {
    // An error where the source ended spanned the last token; its span is empty, at the end.
    id: "end-of-source-span",
    landed: true,
    rows: 157,
    matches: (r, a, b) => {
      const sb = spanOf(b);
      const len = sourceOf(r).length;
      return sameVariant(a, b) && sb !== undefined && sb[0] === len && sb[1] === len;
    },
  },
  {
    // Unrecognised text that starts like an identifier spanned one character; it spans the identifier.
    id: "identifier-run-span",
    landed: true,
    rows: 55,
    matches: (r, a, b) => {
      const sa = spanOf(a);
      const sb = spanOf(b);
      return (
        sameVariant(a, b) &&
        sa !== undefined &&
        sb !== undefined &&
        sb[0] === sa[0] &&
        sb[1] > sa[1] &&
        /[a-zA-Z_]/.test(sourceOf(r)[sa[0]] ?? "")
      );
    },
  },
  {
    // A whitespace run ending in an unterminated `/…` comment was skipped up
    // to the `/`; it is one unrecognised run from where the whitespace began,
    // so the span (and a prefix parse's length) starts there.
    id: "unterminated-comment-run",
    landed: true,
    rows: 13,
    matches: (r, a, b) => {
      const src = sourceOf(r);
      if (r.k === "partial" && !a.startsWith("throw") && !b.startsWith("throw")) {
        return a.split("@")[0] === b.split("@")[0] && src.includes("/");
      }
      const sb = spanOf(b);
      return (
        sameVariant(a, b) &&
        a !== b &&
        sb !== undefined &&
        sb[1] === src.length &&
        /^(?:[ \t\r\n\f]|\/[^/]*\/|#[^\n]*)*\/[^/]*$/.test(src.slice(sb[0]))
      );
    },
  },
  {
    // A hex or base64 literal that fails its pattern was scanned into; the
    // unrecognised text is its identifier prefix (`h`, `b64`).
    id: "literal-prefix-span",
    landed: true,
    rows: 5,
    matches: (r, a, b) => {
      const sa = spanOf(a);
      const sb = spanOf(b);
      return (
        sameVariant(a, b) &&
        sa !== undefined &&
        sb !== undefined &&
        sa[0] === sb[0] &&
        sa[1] !== sb[1] &&
        /^(h'|b64)/.test(sourceOf(r).slice(sa[0]))
      );
    },
  },
  {
    // Unrecognised text spanned one UTF-16 code unit; it spans one code point.
    id: "code-point-span",
    landed: true,
    rows: 1,
    matches: (r, a, b) => {
      const sa = spanOf(a);
      const sb = spanOf(b);
      return (
        sameVariant(a, b) &&
        sa !== undefined &&
        sb !== undefined &&
        sa[0] === sb[0] &&
        sb[1] - sb[0] === 2 &&
        (sourceOf(r).codePointAt(sa[0]) ?? 0) > 0xffff
      );
    },
  },
  {
    // A date literal with non-ASCII digits was never lexed as a date; it is
    // one that does not parse, at every site.
    id: "unicode-date-digits",
    landed: true,
    rows: 7,
    matches: (r) => /\p{Nd}/u.test(sourceOf(r).replace(/[0-9]/g, "")),
  },
];

const frozen = frozenAdapterFor(frozenMod);
const current = adapterFor(src, currentDeps);

describe("differential: frozen surface vs working tree", () => {
  it("frozen bundle integrity", () => {
    const sha = createHash("sha256")
      .update(readFileSync(join(here, "baseline/dcbor-parse-baseline.mjs")))
      .digest("hex");
    expect(sha).toBe(FROZEN_SHA256);
  });
  const hits = new Map<string, number>();
  for (const [name, gen] of Object.entries(categories)) {
    it(`category ${name}`, { timeout: 600_000 }, () => {
      let n = 0;
      const diffs: string[] = [];
      for (const recipe of gen()) {
        if (!isBaselineSupported(recipe)) continue;
        n++;
        const a = materialize(frozen, recipe);
        const b = materialize(current, recipe);
        if (a === b) continue;
        const tomb = TOMBSTONES.find((t) => t.matches(recipe, a, b));
        if (tomb === undefined || !tomb.landed) {
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 80)} !== ${b.slice(0, 80)}`);
        } else {
          hits.set(tomb.id, (hits.get(tomb.id) ?? 0) + 1);
        }
      }
      if (name !== "domain") expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
    });
  }
  it("every tombstone covers exactly the rows it pins", () => {
    const counts = Object.fromEntries(TOMBSTONES.map((t) => [t.id, hits.get(t.id) ?? 0]));
    expect(counts).toEqual(
      Object.fromEntries(TOMBSTONES.map((t) => [t.id, t.landed ? t.rows : 0])),
    );
  });
});

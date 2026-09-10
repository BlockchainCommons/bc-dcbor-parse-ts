/**
 * Differential harness (Phase 1.3): every corpus recipe is parsed with the
 * frozen baseline bundle AND the working tree; bytes, error variants and
 * spans must be identical outside the enumerated tombstones.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import * as baselineMod from "./baseline/dcbor-parse-baseline.mjs";
import * as src from "../src";
import {
  materialize,
  baselineAdapterFor,
  redesignedAdapterFor,
  recipeName,
  type Recipe,
} from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = readFileSync(join(here, "baseline/README.md"), "utf8").match(
  /Baseline sha256: ([0-9a-f]{64})/,
)?.[1];

const sourceOf = (r: Recipe): string => ("src" in r ? r.src : "");

/** Tombstones: the only allowed differences, each a fix towards the reference. */
const TOMBSTONES: {
  id: string;
  landed: boolean;
  matches: (r: Recipe, baselineOutcome: string, currentOutcome: string) => boolean;
}[] = [
  {
    // P1: fractional seconds beyond milliseconds were truncated (a JS Date);
    // the date is now computed as whole seconds + nanoseconds, as the reference does.
    id: "T1-fractional-seconds",
    landed: true,
    matches: (r, a, b) =>
      /T\d\d:\d\d:\d\d\.\d{4,}/.test(sourceOf(r)) && !a.startsWith("throw") && !b.startsWith("throw"),
  },
  {
    // P2: a `:60` leap second was rejected; it is now second 59 plus one second, as the reference does.
    id: "T2-leap-second",
    landed: true,
    matches: (r, a, b) =>
      /:60(\.\d+)?(Z|[+-])/.test(sourceOf(r)) &&
      a.startsWith("throw:InvalidDateString") &&
      !b.startsWith("throw"),
  },
  {
    // P3: a keyword running straight into identifier characters (`truex`) lexed
    // as the keyword plus junk; it is now unrecognised as a whole, as the reference does.
    id: "T3-keyword-runs",
    landed: true,
    matches: (r, _a, b) =>
      /(true|false|null|NaN|Infinity|Unit)[a-zA-Z0-9_-]/.test(sourceOf(r)) &&
      b.startsWith("throw:UnrecognizedToken"),
  },
];

const baseline = baselineAdapterFor(baselineMod);
const current = redesignedAdapterFor(src, currentDeps);

describe("differential: baseline vs working tree", () => {
  it("baseline bundle integrity", () => {
    const sha = createHash("sha256")
      .update(readFileSync(join(here, "baseline/dcbor-parse-baseline.mjs")))
      .digest("hex");
    expect(sha).toBe(BASELINE_SHA256);
  });
  for (const [name, gen] of Object.entries(categories)) {
    it(`category ${name}`, { timeout: 600_000 }, () => {
      let n = 0;
      const diffs: string[] = [];
      for (const recipe of gen()) {
        n++;
        const a = materialize(baseline, recipe);
        const b = materialize(current, recipe);
        const tomb = TOMBSTONES.find((t) => t.matches(recipe, a, b));
        if (a !== b && tomb?.landed !== true)
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 80)} !== ${b.slice(0, 80)}`);
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
    });
  }
});

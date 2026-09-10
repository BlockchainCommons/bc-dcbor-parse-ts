/**
 * Golden snapshot (Phase 0.2): the outcome of every hand-written source
 * string. Reviewable, auto-updatable with -u.
 */
import { describe, it, expect } from "vitest";
import * as src from "../src";
import { materialize, redesignedAdapterFor, recipeName } from "./vectors/recipes";
import { currentDeps } from "./vectors/deps";
import { hand } from "./corpus/corpus";

const api = redesignedAdapterFor(src, currentDeps);

describe("golden: hand corpus", () => {
  it("every hand-written source, parse and partial, and the compose calls", () => {
    const rows = [...hand()].map((r) => `${recipeName(r)}: ${materialize(api, r)}`);
    expect(rows.length).toBeGreaterThan(400);
    expect(rows).toMatchSnapshot();
  });
});

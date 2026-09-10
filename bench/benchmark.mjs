/**
 * Baseline vs working tree micro-benchmarks (Phase 2.3).
 *
 *   bun run build && bun bench/benchmark.mjs
 */
import * as baseline from "../tests/baseline/dcbor-parse-baseline.mjs";
import * as current from "../dist/index.mjs";

const item = '{"name": "Alice", "age": 30, "tags": [1, 2.5, h\'deadbeef\', b64\'SGVsbG8=\', 2023-12-25T10:30:45Z, true, null, 40024(1)], "nested": {"a": [[1], [2, [3]]], "b": \'isA\'}}';
const doc = `[${Array.from({ length: 300 }, () => item).join(", ")}]`; // ~50 kB
const api = (m) => (typeof m.parseDcbor === "function" ? (s) => m.parseDcbor(s) : (s) => m.parseDcborItem(s));
const time = (fn, n) => {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n;
};
const run = (m) => {
  const parse = api(m);
  return [
    [`parse ${(doc.length / 1024).toFixed(0)} kB document`, time(() => parse(doc), 30)],
    ["parse one item", time(() => parse(item), 2000)],
    ["reject (unterminated map)", time(() => parse(doc.slice(0, 20000)), 30)],
  ];
};
const before = run(baseline);
const after = run(current);
console.log(`${"operation".padEnd(30)} ${"baseline".padStart(10)} ${"current".padStart(10)} ${"ratio".padStart(7)}`);
for (let i = 0; i < before.length; i++) {
  const [label, b] = before[i];
  const c = after[i][1];
  console.log(`${label.padEnd(30)} ${b.toFixed(3).padStart(8)}ms ${c.toFixed(3).padStart(8)}ms ${(c / b).toFixed(2).padStart(6)}×`);
}

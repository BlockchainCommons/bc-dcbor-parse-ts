/**
 * Differential corpus (Phase 1.3) and the golden subset (Phase 1.2): the
 * hand-written strings from both implementations' test suites, a
 * grammar-driven generator over every literal kind with nesting, and
 * systematic corruptions. Deterministic.
 */
import { cbor } from "@blockchaincommons/dcbor";
import { UR } from "@blockchaincommons/uniform-resources";
import type { Recipe } from "../vectors/recipes";

const xorshift = (seed: number): (() => number) => {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
};
const pick = <T>(next: () => number, xs: readonly T[]): T => xs[next() % xs.length];

/** Hand-written sources: every token kind, edges, and the parity cases. */
export const HAND: readonly string[] = [
  // keywords and numbers
  "true",
  "false",
  "null",
  "NaN",
  "Infinity",
  "-Infinity",
  "Unit",
  "''",
  "0",
  "1",
  "-1",
  "42",
  "-42",
  "23",
  "24",
  "255",
  "256",
  "65535",
  "65536",
  "4294967295",
  "4294967296",
  "9007199254740991",
  "9007199254740992",
  "18446744073709551615",
  "18446744073709551616",
  "-18446744073709551616",
  "-18446744073709551617",
  "3.14",
  "-0.5",
  "1.0",
  "1e3",
  "1.5e-3",
  "1E3",
  "0.1",
  "-0",
  "00",
  "007",
  "1_000",
  "0x10",
  "+1",
  ".5",
  "5.",
  "1e",
  "--1",
  // strings
  '""',
  '"hello"',
  '"héllo"',
  '"unicode ✓ ☺ 日本"',
  '"🌈"',
  '"with \\"escaped\\" quotes"',
  '"back\\\\slash"',
  '"tab\\there"',
  '"new\\nline"',
  '"\\u0041"',
  '"\\u00e9"',
  '"\\ud83c\\udf08"',
  '"unterminated',
  '"bad \\x escape"',
  '"\\u12"',
  // byte strings
  "h''",
  "h'00'",
  "h'ff'",
  "h'FF'",
  "h'dead'",
  "h'deadbeef'",
  "h'DeAdBeEf'",
  "h'DEADBEEF'",
  "h'0'",
  "h'zz'",
  "h'abc'",
  "h'de ad'",
  "b64''",
  "b64'A'",
  "b64'QQ=='",
  "b64'QQ='",
  "b64'QQ'",
  "b64'SGVsbG8='",
  "b64'SGVsbG8gV29ybGQ='",
  "b64'AQIDBAUGBwgJCg'",
  "b64'AQIDBAUGBwgJCg='",
  "b64'AQIDBAUGBwgJCg=='",
  "b64'!!!invalid!!!'",
  "b64'SGVsbG8gV29ybGQ'",
  // dates
  "2023-01-01",
  "2023-02-08",
  "2023-12-25",
  "1965-05-15",
  "2023-02-08T15:30:45Z",
  "2023-02-08T15:30:45.123Z",
  "2023-12-25T10:30:45.123456Z",
  "2023-02-08T15:30:45+01:00",
  "2023-02-08T15:30:45-08:00",
  "2023-12-25T10:30:45+05:30",
  "2023",
  "2023-02",
  "2023-13-01",
  "2023-02-30",
  "2023-01-32",
  "2023-00-15",
  "2023-06-00",
  "2024-02-29",
  "2023-02-29",
  "1970-01-01T00:00:00Z",
  "2000-01-01T00:00:00.000Z",
  "2023-12-25T24:00:00Z",
  "2023-12-25T10:60:00Z",
  "2023-12-25T10:30:60Z",
  "2023-12-25T10:30:45",
  // tags
  "1(1)",
  "42(123)",
  '0("x")',
  "1(2023-01-01)",
  "40024(1)",
  "18446744073709551615(0)",
  "18446744073709551616(0)",
  "42()",
  "42(1",
  "42(1,2)",
  "42 (1)",
  "-1(1)",
  "1.5(1)",
  "date(1)",
  "date(2023-01-01)",
  'envelope(200(201("x")))',
  "digest(h'00')",
  "nosuchtag(1)",
  "date(1",
  "date 1",
  "seed({1: h'00'})",
  "known-value(1)",
  "encoded-cbor(1)",
  // known values
  "'1'",
  "'0'",
  "'42'",
  "'isA'",
  "'date'",
  "'note'",
  "'18446744073709551615'",
  "'18446744073709551616'",
  "'20000000000000000000'",
  "'nosuchvalue'",
  "'01'",
  "'-1'",
  "'a b'",
  "'",
  "'isA",
  "'is-a'",
  "'_x'",
  // arrays and maps
  "[]",
  "[1]",
  "[1, 2, 3]",
  "[1,2,3]",
  "[ 1 , 2 ]",
  "[\"a\", h'dead', 42]",
  "[[]]",
  "[[1], [2, [3]]]",
  "[1, [2, [3, [4, [5]]]]]",
  "[1,]",
  "[,1]",
  "[1 2]",
  "[1",
  "1]",
  "[1, 2",
  "[]]",
  "[1965-05-15, 2000-07-25, 2004-10-30]",
  "[true, false, null, NaN, Infinity, -Infinity]",
  "{}",
  "{1: 2}",
  '{"a": 1}',
  '{"b": 2, "a": 1}',
  "{1: 2, 3: 4}",
  "{1: 2 3: 4}",
  "{1 2",
  "{1",
  '{"k"',
  "{1: 2, 1: 3}",
  "{1: {2: 3}}",
  "{[1]: 2}",
  "{{1: 2}: 3}",
  "{1:}",
  "{:1}",
  "{1: 2,}",
  "{,}",
  "{1, 2}",
  "{1: 2",
  "1: 2}",
  "{h'00': 1, 1: 2, \"a\": 3, [1]: 4, -1: 5, 0.5: 6}",
  '{2: 1, 1: 2, 10: 3, -1: 4, "z": 5, "a": 6, "aa": 7}',
  // URs
  "ur:date/cyisdadmlasgtapttx",
  "ur:foobar/cyisdadmlasgtapttl",
  "ur:date/cyisdadmlasgtapttl",
  "ur:date/",
  "ur:/abc",
  "ur:date/abc",
  "ur:DATE/cyisdadmlasgtapttx",
  // whitespace and comments
  " 1 ",
  "\t1\n",
  "1 # comment",
  "# comment\n1",
  "1 /inline/",
  "/c/ 1",
  "//42",
  "/unterminated 1",
  "1 // 2",
  "[1, # one\n 2]",
  "",
  " ",
  "\n",
  "#",
  "/",
  // greediness
  "truex",
  "-Infinityzz",
  "nullx",
  "1x",
  "1 2",
  '"a" "b"',
  "[1] [2]",
  "true false",
  // misc punctuation
  ")",
  "(",
  ":",
  ",",
  "]",
  "}",
  "42(",
  "@",
  "1.2.3",
  "..",
  "-",
  "+",
];

/** Compose calls: item lists for arrays and maps. */
export const HAND_COMPOSE: readonly { k: "composeArray" | "composeMap"; items: string[] }[] = [
  { k: "composeArray", items: [] },
  { k: "composeArray", items: ["1", "2", "3"] },
  { k: "composeArray", items: ['"a"', "h'dead'", "42"] },
  { k: "composeArray", items: ["[1, 2]", "[3]"] },
  { k: "composeArray", items: ["1", ""] },
  { k: "composeArray", items: ["1", "[", "2"] },
  { k: "composeMap", items: [] },
  { k: "composeMap", items: ["1", "2"] },
  { k: "composeMap", items: ["1", "2", "3", "4"] },
  { k: "composeMap", items: ['"b"', "2", '"a"', "1"] },
  { k: "composeMap", items: ["1", "{2: 3}"] },
  { k: "composeMap", items: ["1", "2", "1", "3"] },
  { k: "composeMap", items: ["1"] },
  { k: "composeMap", items: ["1", "2", "3"] },
  { k: "composeMap", items: ["", "1"] },
  { k: "composeMap", items: ["1", "]"] },
];

const TAG_NAMES = ["date", "digest", "envelope", "seed", "nosuchtag", "encoded-cbor"];
const KV_NAMES = ["isA", "date", "note", "unit", "nosuchvalue", "1", "0", "42"];

function genString(next: () => number): string {
  const parts = ["a", "b c", "é", "✓", '\\"', "\\\\", "\\n", "\\u0041", "日本", "🌈", " "];
  const n = next() % 4;
  let s = "";
  for (let i = 0; i < n; i++) s += pick(next, parts);
  return `"${s}"`;
}
function genHex(next: () => number): string {
  const n = next() % 5;
  let s = "";
  for (let i = 0; i < n; i++) s += (next() & 0xff).toString(16).padStart(2, "0");
  return `h'${s}'`;
}
function genB64(next: () => number): string {
  const n = next() % 5;
  const bytes = Uint8Array.from({ length: n }, () => next() & 0xff);
  return `b64'${Buffer.from(bytes).toString("base64")}'`;
}
function genNumber(next: () => number): string {
  switch (next() % 8) {
    case 0:
      return String(next() % 100);
    case 1:
      return String(-(next() % 100));
    case 2:
      return String(next());
    case 3:
      return `${next() % 1000}.${next() % 1000}`;
    case 4:
      return `-${next() % 10}.${next() % 100}`;
    case 5:
      return `${next() % 10}e${next() % 5}`;
    case 6:
      return String(BigInt(next()) * BigInt(next()));
    default:
      return pick(next, [
        "0",
        "1",
        "-1",
        "18446744073709551615",
        "1.5",
        "NaN",
        "Infinity",
        "-Infinity",
      ]);
  }
}
function genDate(next: () => number): string {
  const y = 1970 + (next() % 60);
  const m = 1 + (next() % 12);
  const d = 1 + (next() % 28);
  const base = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  switch (next() % 4) {
    case 0:
      return base;
    case 1:
      return `${base}T${String(next() % 24).padStart(2, "0")}:${String(next() % 60).padStart(2, "0")}:${String(next() % 60).padStart(2, "0")}Z`;
    case 2:
      return `${base}T12:00:00.${String(next() % 1000).padStart(3, "0")}Z`;
    default:
      return `${base}T12:00:00${next() % 2 ? "+" : "-"}0${next() % 10}:00`;
  }
}
function genUr(next: () => number): string {
  const type = pick(next, ["date", "digest", "seed", "unknown-type"]);
  const value = pick(next, [1, "x", [1, 2], { a: 1 }]);
  return UR.from(type, cbor(value)).toString();
}
function genItem(next: () => number, depth: number): string {
  const r = next() % (depth > 0 ? 14 : 10);
  switch (r) {
    case 0:
      return pick(next, ["true", "false", "null", "Unit", "''"]);
    case 1:
    case 2:
      return genNumber(next);
    case 3:
      return genString(next);
    case 4:
      return genHex(next);
    case 5:
      return genB64(next);
    case 6:
      return genDate(next);
    case 7:
      return `${next() % 2 ? String(next() % 60000) : pick(next, TAG_NAMES)}(${genItem(next, depth - 1)})`;
    case 8:
      return `'${pick(next, KV_NAMES)}'`;
    case 9:
      return genUr(next);
    case 10:
    case 11: {
      const n = next() % 4;
      const items = Array.from({ length: n }, () => genItem(next, depth - 1));
      const sep = pick(next, [", ", ",", " , "]);
      return `[${items.join(sep)}]`;
    }
    default: {
      const n = next() % 4;
      const entries = Array.from(
        { length: n },
        () => `${genItem(next, depth - 1)}: ${genItem(next, depth - 1)}`,
      );
      return `{${entries.join(", ")}}`;
    }
  }
}

export function* hand(): Generator<Recipe> {
  for (const src of HAND) yield { k: "parse", src };
  for (const src of HAND) yield { k: "partial", src };
  yield* HAND_COMPOSE;
}

/** Grammar-driven sources up to depth 4, then corruptions of a slice of them. */
export function* generated(): Generator<Recipe> {
  const next = xorshift(0x5eed1234);
  const sources: string[] = [];
  for (let i = 0; i < 6000; i++) sources.push(genItem(next, 1 + (next() % 4)));
  for (const src of sources) yield { k: "parse", src };
  for (let i = 0; i < 1500; i++) yield { k: "partial", src: `${sources[i]} ${sources[i + 1]}` };
  // corruptions: truncation at every position, one dropped or doubled character
  for (let i = 0; i < 60; i++) {
    const src = sources[i * 7];
    for (let cut = 1; cut < src.length; cut++) yield { k: "parse", src: src.slice(0, cut) };
    for (let j = 0; j < src.length; j += 3) {
      yield { k: "parse", src: src.slice(0, j) + src.slice(j + 1) };
      yield { k: "parse", src: src.slice(0, j) + src[j] + src.slice(j) };
    }
  }
  for (let i = 0; i < 300; i++) {
    const n = 1 + (next() % 4);
    const items = Array.from({ length: n }, () => genItem(next, 2));
    yield { k: "composeArray", items };
    yield { k: "composeMap", items: n % 2 === 0 ? items : [...items, "1"] };
  }
}

export const categories: Record<string, () => Generator<Recipe>> = { hand, generated };

/** The golden subset: the hand corpus and the first 400 generated sources. */
export function* goldenRecipes(): Generator<Recipe> {
  yield* hand();
  let i = 0;
  for (const r of generated()) {
    if (i++ >= 400) break;
    yield r;
  }
}

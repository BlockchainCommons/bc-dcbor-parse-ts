/**
 * Argument-domain and edge snapshot: the outcome of every input only
 * JavaScript can express (wrong argument types, deep nesting), the inputs
 * where the port and the reference are known to differ, and the runtime
 * shape of the exported tables, errors and the lexer. Reviewable; a change
 * here is a deliberate API change.
 */
import { describe, it, expect } from "vitest";
import { getGlobalTagsStore } from "@blockchaincommons/dcbor";
import { registerTags } from "@blockchaincommons/tags";
import * as P from "../src";
import * as L from "../src/lexer";

registerTags(getGlobalTagsStore());

const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");

/** `bytes`, `bytes@length`, `throw Name(code)@span: message`, or the JSON of a plain value. */
export const outcome = (f: () => unknown): string => {
  try {
    const v = f() as {
      toData?: () => Uint8Array;
      value?: { toData?: () => Uint8Array };
      length?: number;
    };
    if (v !== null && typeof v === "object") {
      if (typeof v.toData === "function") return hex(v.toData());
      if (v.value !== undefined && typeof v.value.toData === "function") {
        return `${hex(v.value.toData())}@${v.length}`;
      }
    }
    return JSON.stringify(v) ?? String(v);
  } catch (e) {
    if (e instanceof Error) {
      const { code, details } = e as {
        code?: unknown;
        details?: { span?: { start: number; end: number } };
      };
      const span = details?.span;
      return `throw ${e.name}${typeof code === "string" ? `(${code})` : ""}${span ? `@${span.start}-${span.end}` : ""}: ${e.message.slice(0, 80)}`;
    }
    return `throw ${String(e)}`;
  }
};

type AnyFn = (...args: unknown[]) => unknown;
const parse = P.parseDcbor as unknown as AnyFn;
const tryParse = P.tryParseDcbor as unknown as AnyFn;
const prefix = P.parseDcborPrefix as unknown as AnyFn;
const composeArray = P.composeDcborArray as unknown as AnyFn;

const rows: Record<string, () => unknown> = {
  // base64 with non-zero trailing bits
  "b64'QR=='": () => parse("b64'QR=='"),
  "b64'QUJ='": () => parse("b64'QUJ='"),
  "b64'QQ=='": () => parse("b64'QQ=='"),
  // years below 100 and offsets at the edge
  "0000-01-01": () => parse("0000-01-01"),
  "0050-01-01": () => parse("0050-01-01"),
  "0099-12-31": () => parse("0099-12-31"),
  "2023-01-01T00:00:00+24:00": () => parse("2023-01-01T00:00:00+24:00"),
  "2023-01-01T00:00:00+23:59": () => parse("2023-01-01T00:00:00+23:59"),
  // a keyword followed by `(`
  "true(1)": () => parse("true(1)"),
  "null(1)": () => parse("null(1)"),
  "NaN(1)": () => parse("NaN(1)"),
  "Unit(1)": () => parse("Unit(1)"),
  "-Infinity(1)": () => parse("-Infinity(1)"),
  // nesting depth
  "[ x 1000": () => parse("[".repeat(1000)),
  "[ x 1001": () => parse("[".repeat(1001)),
  "[ x 5000": () => parse("[".repeat(5000)),
  "balanced 5000": () => parse("[".repeat(5000) + "]".repeat(5000)),
  "tryParseDcbor [ x 5000": () => tryParse("[".repeat(5000)),
  // prefix before an unterminated comment; Unicode digits
  "prefix '1 /unterminated'": () => prefix("1 /unterminated"),
  "arabic-indic digits": () => parse("٢٠٢٣-01-01"),
  // inputs that panic the reference
  "2023-01-01T": () => parse("2023-01-01T"),
  "2023-12-25T10:30:45.": () => parse("2023-12-25T10:30:45."),
  "2023-12-25T10:30:45+0100": () => parse("2023-12-25T10:30:45+0100"),
  "1 followed by an Arabic-Indic digit": () => parse("1١"),
  // known-value names the port and the reference resolve differently
  "'value'": () => parse("'value'"),
  "'Self'": () => parse("'Self'"),
  "'' with a resolver that has no ''": () =>
    parse("''", { knownValues: { byName: () => undefined } }),
  // argument domain
  "parseDcbor(undefined)": () => parse(undefined),
  "parseDcbor(null)": () => parse(null),
  "parseDcbor(123)": () => parse(123),
  "tryParseDcbor(undefined)": () => tryParse(undefined),
  'parseDcbor("1", null)': () => parse("1", null),
  'parseDcbor("1", 5)': () => parse("1", 5),
  'parseDcbor("date(1)", { tags: 5 })': () => parse("date(1)", { tags: 5 }),
  "parseDcbor(\"'isA'\", { knownValues: {} })": () => parse("'isA'", { knownValues: {} }),
  'parseDcbor("1", { maxDepth: 0 })': () => parse("1", { maxDepth: 0 }),
  'parseDcbor("1", { maxDepth: "9" })': () => parse("1", { maxDepth: "9" }),
  'composeDcborArray("1")': () => composeArray("1"),
  "composeDcborArray([1])": () => composeArray([1]),
  // messages and shapes
  "UnexpectedToken message": () => parse("[1,)"),
  "UnexpectedToken details": () => {
    try {
      parse("[1,)");
    } catch (e) {
      return Object.keys((e as { details: object }).details).sort();
    }
    return "no throw";
  },
  "InvalidUr details keys": () => {
    try {
      parse("ur:date/cyisdadmlasgtapttx");
    } catch (e) {
      return Object.keys((e as { details: object }).details).sort();
    }
    return "no throw";
  },
  "Object.isFrozen(DcborParseErrorCode)": () => Object.isFrozen(P.DcborParseErrorCode),
  "Object.isFrozen(DcborComposeErrorCode)": () => Object.isFrozen(P.DcborComposeErrorCode),
  "Object.isFrozen(error.details), (error.details.span)": () => {
    try {
      parse("[1 2]");
    } catch (e) {
      const d = (e as { details: { span: object } }).details;
      return [Object.isFrozen(d), Object.isFrozen(d.span)];
    }
    return "no throw";
  },
  'Object.isFrozen(parseDcborPrefix("1 2"))': () => Object.isFrozen(P.parseDcborPrefix("1 2")),
  "isDcborParseError of a same-shaped error from another copy": () => {
    const e = Object.assign(new Error("m"), { code: "EmptyInput" });
    e.name = "DcborParseError";
    return P.DcborParseError.isDcborParseError(e);
  },
  "error own keys": () => {
    try {
      parse("");
    } catch (e) {
      return Object.keys(e as object).sort();
    }
    return "no throw";
  },
  "new Lexer('\"hi\"').next()": () => new L.Lexer('"hi"').next(),
  "new Lexer('1').next()": () => new L.Lexer("1").next(),
  "Lexer is iterable": () => typeof (new L.Lexer("1") as object)[Symbol.iterator as never],
  "lexer exports": () => Object.keys(L).sort(),
  exports: () => Object.keys(P).sort(),
};

describe("golden: argument domain and edges", () => {
  it("every JS-only input, every known edge, and the runtime shapes", () => {
    const lines = Object.entries(rows).map(([name, f]) => `${name} → ${outcome(f)}`);
    expect(lines).toMatchSnapshot();
  });
});

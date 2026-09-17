/**
 * Vector recipes: a recipe is a source string (or the item strings of a
 * compose call, or the name of a JavaScript-only case); `materialize` runs
 * it through a `VectorApi` and returns one outcome string — the CBOR hex,
 * or `throw:<Variant>` with the span in UTF-16 code units — so the same
 * recipe drives the golden file, the differential and the Rust harness.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ALL_TAGS } from "@blockchaincommons/tags";
import {
  TAG_DATE,
  TAG_NAME_DATE,
  TAG_POSITIVE_BIGNUM,
  TAG_NAME_POSITIVE_BIGNUM,
  TAG_NEGATIVE_BIGNUM,
  TAG_NAME_NEGATIVE_BIGNUM,
} from "@blockchaincommons/dcbor";
import { DOMAIN_CASES } from "../corpus/domain-cases";

export type Recipe =
  | { k: "parse"; src: string }
  | { k: "partial"; src: string }
  | { k: "composeArray"; items: string[] }
  | { k: "composeMap"; items: string[] }
  /** A JavaScript-only input; `s` is a key of `DOMAIN_CASES`. */
  | { k: "domain"; s: string };
export type Outcome = string;

export interface VectorApi {
  /** Parses; returns the encoded bytes, or throws. */
  parse(src: string): Uint8Array;
  /** Parses a prefix; returns the bytes and the consumed length, or throws. */
  partial(src: string): [Uint8Array, number];
  composeArray(items: string[]): Uint8Array;
  composeMap(items: string[]): Uint8Array;
  /** Runs a domain case against the surface; absent when the surface cannot express them. */
  domain?(name: string): unknown;
  /** `Variant`, `Variant(TokenType)`, with `@start-end` when the error has a span. */
  errorCode(e: unknown): string | undefined;
}

export const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");

export const isBaselineSupported = (r: Recipe): boolean => r.k !== "domain";

export function recipeName(r: Recipe): string {
  if (r.k === "domain") return `domain ${r.s}`;
  const s = r.k === "parse" || r.k === "partial" ? r.src : r.items.join(" | ");
  return `${r.k} ${JSON.stringify(s).slice(0, 60)}`;
}

const throwOutcome = (api: VectorApi, e: unknown): Outcome => {
  const code = api.errorCode(e);
  if (code !== undefined) return `throw:${code}`;
  // Only the class of a foreign error is recorded: engine messages differ between runtimes.
  return e instanceof Error ? `throw:${e.name}` : `throw:${String(e)}`;
};

const valueOutcome = (v: unknown): Outcome => {
  const x = v as {
    toData?: () => Uint8Array;
    value?: { toData?: () => Uint8Array };
    length?: number;
  };
  if (x !== null && typeof x === "object") {
    if (typeof x.toData === "function") return hex(x.toData());
    if (x.value !== undefined && typeof x.value.toData === "function") {
      return `${hex(x.value.toData())}@${x.length}`;
    }
    if ("ok" in x) {
      const r = x as { ok: boolean; value?: unknown; error?: unknown };
      return r.ok ? `ok:${valueOutcome(r.value)}` : `err:${String((r.error as Error).message)}`;
    }
  }
  return `value:${JSON.stringify(v) ?? String(v)}`;
};

export function materialize(api: VectorApi, r: Recipe): Outcome {
  try {
    switch (r.k) {
      case "parse":
        return hex(api.parse(r.src));
      case "partial": {
        const [bytes, consumed] = api.partial(r.src);
        return `${hex(bytes)}@${consumed}`;
      }
      case "composeArray":
        return hex(api.composeArray(r.items));
      case "composeMap":
        return hex(api.composeMap(r.items));
      case "domain":
        if (api.domain === undefined) return "unsupported";
        return valueOutcome(api.domain(r.s));
    }
  } catch (e) {
    return throwOutcome(api, e);
  }
}

/** Renders a parse-error-shaped object (the frozen and the current surface agree on the shape). */
const describeError = (err: any): string => {
  if (err === undefined || err === null || typeof err !== "object") return String(err);
  const type: string = err.type ?? err.code ?? "?";
  const kind: string | undefined = err.kind ?? err.token?.type;
  const token = kind !== undefined ? `(${kind})` : "";
  const span = err.span ?? err.details?.span;
  return `${type}${token}${span !== undefined ? `@${span.start}-${span.end}` : ""}`;
};

class ResultError extends Error {
  constructor(readonly inner: unknown) {
    super("result error");
  }
}

/** The frozen surface before 1.0.0-beta.1: `ParseResult` objects, `dcbor-compat` values. */
export function frozenAdapterFor(m: any): VectorApi {
  // The same names the working tree registers: dcbor's standard tags and
  // every BC tag (the old `registerTags()` did both).
  m.baselineRegisterTags([
    { value: TAG_DATE, name: TAG_NAME_DATE },
    { value: TAG_POSITIVE_BIGNUM, name: TAG_NAME_POSITIVE_BIGNUM },
    { value: TAG_NEGATIVE_BIGNUM, name: TAG_NAME_NEGATIVE_BIGNUM },
    ...ALL_TAGS.map((t) => ({ value: t.value, name: t.name })),
  ]);
  const unwrap = <T>(r: any): T => {
    if (!r.ok) throw new ResultError(r.error);
    return r.value;
  };
  return {
    parse: (src) => unwrap<any>(m.parseDcborItem(src)).toData(),
    partial: (src) => {
      const [value, consumed] = unwrap<any>(m.parseDcborItemPartial(src));
      return [value.toData(), consumed];
    },
    composeArray: (items) => unwrap<any>(m.composeDcborArray(items)).toData(),
    composeMap: (items) => unwrap<any>(m.composeDcborMap(items)).toData(),
    errorCode: (e) => {
      if (!(e instanceof ResultError)) return undefined;
      const inner: any = e.inner;
      if (inner?.type === "ParseError" && inner.error !== undefined)
        return `Compose:ParseError:${describeError(inner.error)}`;
      // ComposeError's DuplicateMapKey carries no span; ParseError's does.
      if (
        inner?.type === "OddMapLength" ||
        (inner?.type === "DuplicateMapKey" && inner.span === undefined)
      )
        return `Compose:${inner.type}`;
      return describeError(inner);
    },
  };
}

/** The current surface: throwing `parseDcborItem` and friends with `DcborParseError { code, details }`. */
export function adapterFor(m: any, deps: { registerTags: () => void }): VectorApi {
  deps.registerTags();
  return {
    parse: (src) => m.parseDcborItem(src).toData(),
    partial: (src) => {
      const { value, length } = m.parseDcborItemPartial(src);
      return [value.toData(), length];
    },
    composeArray: (items) => m.composeDcborArray(items).toData(),
    composeMap: (items) => m.composeDcborMap(items).toData(),
    domain(name) {
      const c = DOMAIN_CASES[name];
      if (c === undefined) throw new Error(`unknown domain case ${name}`);
      return c(m);
    },
    errorCode: (e) => {
      const x: any = e;
      const parseShape = (e: any): unknown => ({
        type: e.code,
        kind: e.details?.token?.type,
        span: e.details?.span,
      });
      if (x?.name === "DcborComposeError") {
        if (x.code === "ParseError")
          return `Compose:ParseError:${describeError(parseShape(x.cause))}`;
        return `Compose:${x.code}`;
      }
      if (x?.name !== "DcborParseError") return undefined;
      return describeError(parseShape(x));
    },
  };
}

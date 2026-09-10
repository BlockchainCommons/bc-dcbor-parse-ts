/**
 * Vector recipes (Phase 1.1): a recipe is a source string (or the item
 * strings of a compose call); `materialize` runs it through a `VectorApi`
 * and returns one outcome string — the CBOR hex, or `throw:<Variant>` with
 * the span in UTF-16 code units — so the same recipe drives the golden
 * file, the differential and the Rust harness.
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

export type Recipe =
  | { k: "parse"; src: string }
  | { k: "partial"; src: string }
  | { k: "composeArray"; items: string[] }
  | { k: "composeMap"; items: string[] };
export type Outcome = string;

export interface VectorApi {
  /** Parses; returns the encoded bytes, or throws. */
  parse(src: string): Uint8Array;
  /** Parses a prefix; returns the bytes and the consumed length, or throws. */
  partial(src: string): [Uint8Array, number];
  composeArray(items: string[]): Uint8Array;
  composeMap(items: string[]): Uint8Array;
  /** `Variant`, `Variant(TokenType)`, with `@start-end` when the error has a span. */
  errorCode(e: unknown): string | undefined;
}

export const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");

export function recipeName(r: Recipe): string {
  const s = r.k === "parse" || r.k === "partial" ? r.src : r.items.join(" | ");
  return `${r.k} ${JSON.stringify(s).slice(0, 60)}`;
}

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
    }
  } catch (e) {
    return `throw:${api.errorCode(e) ?? (e as Error).message}`;
  }
}

/** Renders a `ParseError`-shaped object (baseline and current agree on the shape). */
const describeError = (err: any): string => {
  if (err === undefined || err === null || typeof err !== "object") return String(err);
  const type: string = err.type ?? err.code ?? "?";
  const token = err.token?.type !== undefined ? `(${err.token.type})` : "";
  const span = err.span ?? err.details?.span;
  return `${type}${token}${span !== undefined ? `@${span.start}-${span.end}` : ""}`;
};

class ResultError extends Error {
  constructor(readonly inner: unknown) {
    super("result error");
  }
}

/** Pre-redesign surface: `ParseResult` objects, `dcbor-compat` values. */
export function baselineAdapterFor(m: any): VectorApi {
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

/**
 * Redesigned surface (Phase 3): throwing `parseDcbor`/`parseDcborPrefix`/
 * `composeDcborArray`/`composeDcborMap` with `DcborParseError { code, details }`.
 * Until it lands, the working tree speaks the baseline surface over the
 * canonical dcbor, so the adapter falls back to that shape.
 */
export function redesignedAdapterFor(m: any, deps: { registerTags: () => void }): VectorApi {
  deps.registerTags();
  if (typeof m.parseDcbor !== "function") {
    const b = baselineAdapterFor({ ...m, baselineRegisterTags: () => undefined });
    return b;
  }
  return {
    parse: (src) => m.parseDcbor(src).toData(),
    partial: (src) => {
      const { value, length } = m.parseDcborPrefix(src);
      return [value.toData(), length];
    },
    composeArray: (items) => m.composeDcborArray(items).toData(),
    composeMap: (items) => m.composeDcborMap(items).toData(),
    errorCode: (e) => {
      const x: any = e;
      if (x?.name === "DcborComposeError") {
        if (x.code === "ParseError") return `Compose:ParseError:${describeError(x.cause)}`;
        return `Compose:${x.code}`;
      }
      if (x?.name !== "DcborParseError") return undefined;
      return describeError({ type: x.code, token: x.details?.token, span: x.details?.span });
    },
  };
}

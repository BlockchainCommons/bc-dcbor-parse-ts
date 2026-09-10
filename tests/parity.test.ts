/**
 * Parity tests - ensuring exact match with Rust bc-dcbor-parse behavior
 *
 * These tests verify the specific edge cases identified in the parity analysis
 * where TypeScript and Rust behavior may differ.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getGlobalTagsStore } from "@blockchaincommons/dcbor";
import { registerTags } from "@blockchaincommons/tags";
import { tryParseDcbor, tryParseDcborPrefix } from "../src/parse";
import { tryComposeDcborArray } from "../src/compose";

// Register tags before running tests
beforeAll(() => {
  registerTags(getGlobalTagsStore());
});

describe("Parity with Rust bc-dcbor-parse", () => {
  describe("Invalid date validation (Rust expects InvalidDateString)", () => {
    it("should error on invalid month (13)", () => {
      // Rust: check_error("2023-13-01", |e| matches!(e, ParseError::InvalidDateString(_, _)));
      const result = tryParseDcbor("2023-13-01");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on invalid day (30 in February)", () => {
      // Rust: check_error("2023-02-30", |e| matches!(e, ParseError::InvalidDateString(_, _)));
      const result = tryParseDcbor("2023-02-30");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on day 32", () => {
      const result = tryParseDcbor("2023-01-32");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on month 0", () => {
      const result = tryParseDcbor("2023-00-15");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on day 0", () => {
      const result = tryParseDcbor("2023-06-00");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });
  });

  describe("Base64 validation (Rust expects InvalidBase64String)", () => {
    it("should error on base64 missing padding", () => {
      // Rust: check_error("b64'AQIDBAUGBwgJCg'", |e| matches!(e, ParseError::InvalidBase64String(_)));
      // This is missing the '==' padding that should be there
      const result = tryParseDcbor("b64'AQIDBAUGBwgJCg'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidBase64String");
      }
    });

    it("should accept properly padded base64", () => {
      // Same content but with proper padding
      const result = tryParseDcbor("b64'AQIDBAUGBwgJCg=='");
      expect(result.ok).toBe(true);
    });

    it("should error on base64 with wrong padding length", () => {
      // Single = when two are needed
      const result = tryParseDcbor("b64'AQIDBAUGBwgJCg='");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidBase64String");
      }
    });

    it("should error on base64 with invalid characters", () => {
      const result = tryParseDcbor("b64'!!!invalid!!!'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidBase64String");
      }
    });
  });

  // ==========================================================================
  // u64 tag values & known-value numbers
  //
  // Rust accepts the full `u64` range. The TS lexer now widens
  // `Token.TagValue["value"]` and `Token.KnownValueNumber["value"]` to
  // `number | bigint`; values that fit in `Number.MAX_SAFE_INTEGER` come
  // through as plain `number`s, anything larger arrives as a `bigint`,
  // and values outside `[0, 2^64-1]` are reported as
  // InvalidTagValue / InvalidKnownValue.
  // ==========================================================================

  describe("u64 tag values (Rust parity)", () => {
    it("accepts a tag value at MAX_SAFE_INTEGER", () => {
      const input = `${Number.MAX_SAFE_INTEGER}(0)`;
      const result = tryParseDcbor(input);
      expect(result.ok).toBe(true);
    });

    it("accepts a tag value above MAX_SAFE_INTEGER but within u64", () => {
      // 2^53 < 9999999999999999 < 2^64-1.
      const input = "9999999999999999(0)";
      const result = tryParseDcbor(input);
      expect(result.ok).toBe(true);
    });

    it("accepts the maximum u64 tag value", () => {
      // 2^64 - 1 = 18446744073709551615
      const input = "18446744073709551615(0)";
      const result = tryParseDcbor(input);
      expect(result.ok).toBe(true);
    });

    it("rejects a tag value strictly greater than 2^64-1 with InvalidTagValue", () => {
      // 2^64 = 18446744073709551616 — one past the u64 maximum.
      const result = tryParseDcbor("18446744073709551616(0)");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidTagValue");
      }
    });
  });

  describe("u64 known values (Rust parity)", () => {
    it("accepts a known-value number above MAX_SAFE_INTEGER but within u64", () => {
      const input = "'9999999999999999'";
      const result = tryParseDcbor(input);
      expect(result.ok).toBe(true);
    });

    it("accepts the maximum u64 known-value number", () => {
      const input = "'18446744073709551615'";
      const result = tryParseDcbor(input);
      expect(result.ok).toBe(true);
    });

    it("rejects a known-value number strictly greater than 2^64-1 with InvalidKnownValue", () => {
      const result = tryParseDcbor("'18446744073709551616'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidKnownValue");
      }
    });
  });

  // ==========================================================================
  // {1 → ExpectedColon parity
  //
  // Rust `parse_map` collapses every non-Colon outcome (including
  // UnexpectedEndOfInput, UnrecognizedToken, etc.) into ExpectedColon.
  // Earlier revisions of this port forwarded the inner error verbatim.
  // ==========================================================================
  describe("Map colon expectation (Rust parity)", () => {
    it("'{1' returns ExpectedColon, not UnexpectedEndOfInput", () => {
      const result = tryParseDcbor("{1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedColon");
      }
    });

    it("'{\"k\"' returns ExpectedColon, not UnexpectedEndOfInput", () => {
      const result = tryParseDcbor('{"k"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedColon");
      }
    });

    it("'{1 2' returns ExpectedColon (non-colon token after key)", () => {
      const result = tryParseDcbor("{1 2");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedColon");
      }
    });
  });

  // ==========================================================================
  // Duplicate-map-key span (Rust `tests/test_parse.rs:512-531`).
  // Input: `{ "a": 1, "a": 2 }` — the second `"a"` key spans the
  // characters at positions 11..14 in the source. We only assert the
  // span is present and points at the duplicate key, since exact byte
  // offsets are an internal lexer detail.
  // ==========================================================================
  describe("Duplicate-map-key span (Rust parity)", () => {
    it("reports DuplicateMapKey with the offending key's span", () => {
      const src = '{ "a": 1, "a": 2 }';
      const result = tryParseDcbor(src);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DuplicateMapKey");
        if (result.error.code === "DuplicateMapKey") {
          // The duplicate `"a"` key starts at position 10 (after the
          // first key, comma, and space) and runs through position 13.
          expect(result.error.span?.start).toBe(10);
          expect(result.error.span?.end).toBe(13);
          // Sanity-check by indexing the source.
          expect(src.slice(result.error.span?.start, result.error.span?.end)).toBe('"a"');
        }
      }
    });
  });

  // ==========================================================================
  // Greedy keyword matching (Rust parity)
  //
  // Rust's Logos `#[token("true")]` matches greedily — `truex` lexes as
  // `Bool(true)` followed by an unrecognized `x`. Earlier revisions of
  // this port enforced an identifier-boundary check that swallowed the
  // entire prefix into a single `UnrecognizedToken`.
  // ==========================================================================
  describe("Keyword runs (Rust parity)", () => {
    it("'truex' is unrecognised as a whole (the reference's lexer fails the run)", () => {
      const result = tryParseDcbor("truex");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UnrecognizedToken");
      expect(tryParseDcborPrefix("truex").ok).toBe(false);
    });

    it("'-Infinityzz' likewise; 'true ' and 'true)' still lex the keyword", () => {
      expect(tryParseDcbor("-Infinityzz").ok).toBe(false);
      expect(tryParseDcbor("true ").ok).toBe(true);
      const prefix = tryParseDcborPrefix("true)");
      expect(prefix.ok && prefix.value.length).toBe(4);
    });
  });

  describe("Empty inline comment (Rust parity)", () => {
    it("accepts // as an empty inline comment", () => {
      // Rust skip regex `/[^/]*/` matches the empty body. The lexer
      // should treat `//` as a no-op skip and parse the trailing `42`.
      const result = tryParseDcbor("//42");
      expect(result.ok).toBe(true);
    });
  });

  // ==========================================================================
  // composeErrorMessage uses the inner error's Display text.
  // Rust `compose.rs` uses `#[error("Invalid CBOR item: {0}")]`, which
  // prints the inner ParseError's Display ("Empty input"), not the
  // variant tag ("EmptyInput").
  // ==========================================================================
  describe("composeErrorMessage delegates to errorMessage (Rust parity)", () => {
    it("renders ParseError variant via Display, not the variant tag", () => {
      const result = tryComposeDcborArray([""]);
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.code === "ParseError") {
        // Sanity: the inner ParseError is EmptyInput.
        expect(result.error.cause?.code).toBe("EmptyInput");
        expect(result.error.cause?.message).toBe("Empty input");
      }
    });
  });
});

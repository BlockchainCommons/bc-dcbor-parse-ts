/**
 * Edge cases where a port could drift from the reference: calendar
 * validation, base64 padding, the unsigned 64-bit range of tag values and
 * known values, map colon handling, error spans, keyword runs, empty
 * comments and compose messages.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getGlobalTagsStore } from "@blockchaincommons/dcbor";
import { registerTags } from "@blockchaincommons/tags";
import { tryParseDcborItem, tryParseDcborItemPartial } from "../src/parse";
import { tryComposeDcborArray } from "../src/compose";

// Register tags before running tests
beforeAll(() => {
  registerTags(getGlobalTagsStore());
});

describe("reference edge cases", () => {
  describe("invalid dates are InvalidDateString", () => {
    it("should error on invalid month (13)", () => {
      const result = tryParseDcborItem("2023-13-01");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on invalid day (30 in February)", () => {
      const result = tryParseDcborItem("2023-02-30");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on day 32", () => {
      const result = tryParseDcborItem("2023-01-32");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on month 0", () => {
      const result = tryParseDcborItem("2023-00-15");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });

    it("should error on day 0", () => {
      const result = tryParseDcborItem("2023-06-00");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidDateString");
      }
    });
  });

  describe("base64 padding is InvalidBase64String", () => {
    it("should error on base64 missing padding", () => {
      const result = tryParseDcborItem("b64'AQIDBAUGBwgJCg'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidBase64String");
      }
    });

    it("should accept properly padded base64", () => {
      const result = tryParseDcborItem("b64'AQIDBAUGBwgJCg=='");
      expect(result.ok).toBe(true);
    });

    it("should error on base64 with wrong padding length", () => {
      const result = tryParseDcborItem("b64'AQIDBAUGBwgJCg='");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidBase64String");
      }
    });

    it("should treat base64 with invalid characters as unrecognised text", () => {
      const result = tryParseDcborItem("b64'!!!invalid!!!'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UnrecognizedToken");
      }
    });
  });

  // Tag values and known-value numbers accept the full unsigned 64-bit
  // range; a value beyond it is InvalidTagValue / InvalidKnownValue.
  describe("u64 tag values", () => {
    it("accepts a tag value at MAX_SAFE_INTEGER", () => {
      const input = `${Number.MAX_SAFE_INTEGER}(0)`;
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(true);
    });

    it("accepts a tag value above MAX_SAFE_INTEGER but within u64", () => {
      const input = "9999999999999999(0)";
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(true);
    });

    it("accepts the maximum u64 tag value", () => {
      const input = "18446744073709551615(0)";
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(true);
    });

    it("rejects a tag value strictly greater than 2^64-1 with InvalidTagValue", () => {
      const result = tryParseDcborItem("18446744073709551616(0)");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidTagValue");
      }
    });
  });

  describe("u64 known values", () => {
    it("accepts a known-value number above MAX_SAFE_INTEGER but within u64", () => {
      const input = "'9999999999999999'";
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(true);
    });

    it("accepts the maximum u64 known-value number", () => {
      const input = "'18446744073709551615'";
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(true);
    });

    it("rejects a known-value number strictly greater than 2^64-1 with InvalidKnownValue", () => {
      const result = tryParseDcborItem("'18446744073709551616'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidKnownValue");
      }
    });
  });

  // After a map key, anything but a colon (including the end of the input)
  // is ExpectedColon.
  describe("map colon expectation", () => {
    it("'{1' returns ExpectedColon, not UnexpectedEndOfInput", () => {
      const result = tryParseDcborItem("{1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedColon");
      }
    });

    it("'{\"k\"' returns ExpectedColon, not UnexpectedEndOfInput", () => {
      const result = tryParseDcborItem('{"k"');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedColon");
      }
    });

    it("'{1 2' returns ExpectedColon (non-colon token after key)", () => {
      const result = tryParseDcborItem("{1 2");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedColon");
      }
    });
  });

  // A duplicate map key is reported at the second key's span.
  describe("duplicate-map-key span", () => {
    it("reports DuplicateMapKey with the offending key's span", () => {
      const src = '{ "a": 1, "a": 2 }';
      const result = tryParseDcborItem(src);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DuplicateMapKey");
        if (result.error.code === "DuplicateMapKey") {
          expect(result.error.span?.start).toBe(10);
          expect(result.error.span?.end).toBe(13);
          expect(src.slice(result.error.span?.start, result.error.span?.end)).toBe('"a"');
        }
      }
    });
  });

  // A keyword running into identifier characters is one unrecognised token.
  describe("keyword runs", () => {
    it("'truex' is unrecognised as a whole", () => {
      const result = tryParseDcborItem("truex");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UnrecognizedToken");
      expect(tryParseDcborItemPartial("truex").ok).toBe(false);
    });

    it("'-Infinityzz' likewise; 'true ' and 'true)' still lex the keyword", () => {
      expect(tryParseDcborItem("-Infinityzz").ok).toBe(false);
      expect(tryParseDcborItem("true ").ok).toBe(true);
      const prefix = tryParseDcborItemPartial("true)");
      expect(prefix.ok && prefix.value.length).toBe(4);
    });
  });

  describe("empty inline comment", () => {
    it("accepts // as an empty inline comment", () => {
      const result = tryParseDcborItem("//42");
      expect(result.ok).toBe(true);
    });
  });

  // A compose error wraps the item's error message, not its code.
  describe("compose error message", () => {
    it("carries the inner error's message", () => {
      const result = tryComposeDcborArray([""]);
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.code === "ParseError") {
        expect(result.error.cause?.code).toBe("EmptyInput");
        expect(result.error.cause?.message).toBe("Empty input");
      }
    });
  });
});

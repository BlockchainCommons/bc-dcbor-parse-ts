/**
 * Parse tests: the reference suite's cases and this package's additions.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  type Cbor,
  cbor,
  CborMap,
  CborDate,
  expectNumber,
  getGlobalTagsStore,
  taggedValue,
} from "@blockchaincommons/dcbor";
import { registerTags } from "@blockchaincommons/tags";
import { IS_A, UNIT } from "@blockchaincommons/known-values";
import { UR } from "@blockchaincommons/uniform-resources";
import { tryParseDcborItem, tryParseDcborItemPartial } from "../src/parse";
import { type DcborParseErrorCode } from "../src/error";
import { diagnostic } from "@blockchaincommons/dcbor/diagnostic";

// Register tags before running tests
beforeAll(() => {
  registerTags(getGlobalTagsStore());
});

/**
 * Helper function for roundtrip testing.
 * Parses the diagnostic output of a Cbor value and checks it matches.
 */
function roundtrip(value: Cbor): void {
  const src = diagnostic(value);
  const result = tryParseDcborItem(src);
  if (!result.ok) {
    throw new Error(`Parse error: ${result.error.fullMessage(src)}`);
  }
  expect(diagnostic(result.value)).toBe(diagnostic(value));
}

function hexDiagnostic(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `h'${hex}'`;
}

function base64Diagnostic(bytes: Uint8Array): string {
  // Use Buffer for base64 encoding (works in Node.js/Bun)
  return `b64'${Buffer.from(bytes).toString("base64")}'`;
}

describe("parse", () => {
  describe("basic types", () => {
    it("should parse booleans", () => {
      roundtrip(cbor(true));
      roundtrip(cbor(false));
    });

    it("should parse null", () => {
      roundtrip(cbor(null));
    });

    it("should parse integers", () => {
      roundtrip(cbor(10));
      roundtrip(cbor(0));
      roundtrip(cbor(-1));
      roundtrip(cbor(42));
    });

    it("should parse floats", () => {
      roundtrip(cbor(3.28));
      roundtrip(cbor(3.14));
    });

    it("should parse infinity", () => {
      roundtrip(cbor(Infinity));
      roundtrip(cbor(-Infinity));
    });

    it("should parse strings", () => {
      roundtrip(cbor("Hello, world!"));
      roundtrip(cbor(""));
      roundtrip(cbor("unicode: \u{1F600}"));
    });
  });

  describe("byte strings", () => {
    it("should parse hex byte strings", () => {
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a]);
      const cborBytes = cbor(bytes);
      roundtrip(cborBytes);

      const hex = hexDiagnostic(bytes);
      expect(hex).toBe("h'0102030405060708090a'");
      const result = tryParseDcborItem(hex);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe(diagnostic(cborBytes));
      }
    });

    it("should parse base64 byte strings", () => {
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a]);
      const cborBytes = cbor(bytes);

      const base64 = base64Diagnostic(bytes);
      expect(base64).toBe("b64'AQIDBAUGBwgJCg=='");
      const result = tryParseDcborItem(base64);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe(diagnostic(cborBytes));
      }
    });
  });

  describe("NaN", () => {
    it("should parse NaN", () => {
      const cborNaN = cbor(NaN);
      const src = diagnostic(cborNaN);
      expect(src).toBe("NaN");
      const result = tryParseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Number.isNaN(expectNumber(result.value))).toBe(true);
      }
    });
  });

  describe("tagged values", () => {
    it("should parse tagged byte strings", () => {
      roundtrip(taggedValue(1234, cbor(new Uint8Array([1, 2, 3]))));
    });

    it("should parse tagged strings", () => {
      roundtrip(taggedValue(5678, cbor("Hello, world!")));
    });

    it("should parse tagged booleans", () => {
      roundtrip(taggedValue(9012, cbor(true)));
    });
  });

  describe("arrays", () => {
    it("should parse empty arrays", () => {
      roundtrip(cbor([]));
    });

    it("should parse integer arrays", () => {
      roundtrip(cbor([cbor(1), cbor(2), cbor(3)]));
    });

    it("should parse mixed arrays", () => {
      roundtrip(cbor([cbor(true), cbor(false), cbor(null)]));
    });

    it("should parse nested arrays", () => {
      roundtrip(cbor([cbor([cbor(1), cbor(2)]), cbor([cbor(3), cbor(4)])]));
    });
  });

  describe("maps", () => {
    it("should parse empty maps", () => {
      const map = new CborMap();
      roundtrip(cbor(map));
    });

    it("should parse string-keyed maps", () => {
      const map = new CborMap();
      map.set(cbor("key1"), cbor(1));
      map.set(cbor("key2"), cbor(2));
      map.set(cbor("key3"), cbor(3));
      roundtrip(cbor(map));
    });

    it("should parse integer-keyed maps", () => {
      const map = new CborMap();
      map.set(cbor(1), cbor("value1"));
      map.set(cbor(2), cbor("value2"));
      map.set(cbor(3), cbor("value3"));
      roundtrip(cbor(map));
    });
  });

  describe("known values", () => {
    it("should parse known value by number", () => {
      const v = IS_A;
      const cborValue = v.toCbor();
      const src = diagnostic(cborValue);
      expect(src).toBe("40000(1)");
      const result = tryParseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe(diagnostic(cborValue));
      }
    });

    it("should parse known value with single quotes", () => {
      const v = IS_A;
      const cborValue = v.toCbor();

      // Test '1'
      const result2 = tryParseDcborItem("'1'");
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(diagnostic(result2.value)).toBe(diagnostic(cborValue));
      }

      // Test 'isA'
      const result3 = tryParseDcborItem("'isA'");
      expect(result3.ok).toBe(true);
      if (result3.ok) {
        expect(diagnostic(result3.value)).toBe(diagnostic(cborValue));
      }
    });

    it("should parse unit known value", () => {
      const v = UNIT;
      const cborValue = v.toCbor();
      const src = diagnostic(cborValue);
      expect(src).toBe("40000(0)");

      // Test various unit representations
      const tests = ["40000(0)", "'0'", "''", "Unit"];
      for (const test of tests) {
        const result = tryParseDcborItem(test);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(diagnostic(result.value)).toBe(diagnostic(cborValue));
        }
      }
    });
  });

  describe("errors", () => {
    function checkError(source: string, expectedType: DcborParseErrorCode): void {
      const result = tryParseDcborItem(source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(expectedType);
      }
    }

    it("should error on empty input", () => {
      checkError("", "EmptyInput");
    });

    it("should error on unexpected end of input", () => {
      checkError("[1, 2", "UnexpectedEndOfInput");
      checkError("[1, 2,\n3, 4,", "UnexpectedEndOfInput");
    });

    it("should error on extra data", () => {
      checkError("1 1", "ExtraData");
    });

    it("should error on unexpected token", () => {
      checkError("(", "UnexpectedToken");
    });

    it("carries the token in an unexpected-token error", () => {
      const result = tryParseDcborItem("[1,)");
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.details.code === "UnexpectedToken") {
        expect(result.error.details.token).toEqual({
          type: "ParenthesisClose",
          span: { start: 3, end: 4 },
        });
        expect(result.error.message).toBe("Unexpected token `)`");
      }
    });

    it("should error on unrecognized token", () => {
      checkError("q", "UnrecognizedToken");
    });

    it("should error on expected comma", () => {
      checkError("[1 2 3]", "ExpectedComma");
    });

    it("should error on expected colon", () => {
      checkError("{1: 2, 3}", "ExpectedColon");
    });

    it("should error on unmatched parentheses", () => {
      checkError("1([1, 2, 3]", "UnmatchedParentheses");
    });

    it("should error on unmatched braces", () => {
      checkError("{1: 2, 3: 4", "UnmatchedBraces");
    });

    it("should error on expected map key", () => {
      checkError("{1: 2, 3:}", "ExpectedMapKey");
    });

    it("should error on invalid tag value", () => {
      checkError("20000000000000000000(1)", "InvalidTagValue");
    });

    it("should error on unknown tag name", () => {
      checkError("foobar(1)", "UnknownTagName");
    });

    it("should error on invalid hex string", () => {
      checkError("h'01020'", "InvalidHexString");
    });

    it("should error on invalid base64 string", () => {
      // `b64'AQIDBAUGBwgJCg'` lacks its padding.
      checkError("b64'AQIDBAUGBwgJCg'", "InvalidBase64String");
    });

    it("should error on unknown known value name", () => {
      checkError("'foobar'", "UnknownKnownValueName");
    });

    it("should error on invalid date format", () => {
      // Month 13 and February 30 match the literal's grammar but are not
      // calendar dates; dcbor's date parser rejects them.
      checkError("2023-13-01", "InvalidDateString");
      checkError("2023-02-30", "InvalidDateString");
    });
  });

  describe("inside arrays", () => {
    const outcome = (src: string): string => {
      const result = tryParseDcborItem(src);
      if (result.ok) return "ok";
      const { error } = result;
      const span = error.span === undefined ? "" : `@${error.span.start}-${error.span.end}`;
      if (error.details.code !== "UnexpectedToken") return `${error.code}${span}`;
      const { token } = error.details;
      const payload =
        "value" in token && typeof token.value === "object" && "ok" in token.value
          ? `:${token.value.ok ? "ok" : token.value.error.code}`
          : "";
      return `UnexpectedToken(${token.type}${payload})${span}`;
    };

    it("rejects Unit as an element and accepts it everywhere else", () => {
      expect(outcome("[Unit]")).toBe("UnexpectedToken(Unit)@1-5");
      expect(outcome("[1, Unit, 2]")).toBe("UnexpectedToken(Unit)@4-8");
      expect(outcome("[Unit 1]")).toBe("UnexpectedToken(Unit)@1-5");
      expect(outcome("[1 Unit]")).toBe("ExpectedComma@3-7");
      expect(outcome("[[Unit]]")).toBe("UnexpectedToken(Unit)@2-6");
      expect(outcome("{Unit: 1}")).toBe("ok");
      expect(outcome("{1: Unit}")).toBe("ok");
      expect(outcome("1(Unit)")).toBe("ok");
      expect(outcome("Unit")).toBe("ok");
    });

    it("reports a literal that did not decode as the token, not as its own error", () => {
      expect(outcome("[h'abc']")).toBe("UnexpectedToken(ByteStringHex:InvalidHexString)@1-7");
      expect(outcome("[1, 2, h'abc']")).toBe(
        "UnexpectedToken(ByteStringHex:InvalidHexString)@7-13",
      );
      expect(outcome("[b64'QR==']")).toBe(
        "UnexpectedToken(ByteStringBase64:InvalidBase64String)@1-10",
      );
      expect(outcome("[2023-13-45]")).toBe("UnexpectedToken(DateLiteral:InvalidDateString)@1-11");
      expect(outcome("[99999999999999999999999(1)]")).toBe(
        "UnexpectedToken(TagValue:InvalidTagValue)@1-25",
      );
      expect(outcome("['99999999999999999999999']")).toBe(
        "UnexpectedToken(KnownValueNumber:InvalidKnownValue)@1-26",
      );
      expect(outcome("[ur:foo/aaaaaaaa]")).toBe("UnexpectedToken(UR:InvalidUr)@1-16");
      expect(outcome("h'abc'")).toBe("InvalidHexString@0-6");
      expect(outcome("{h'abc': 1}")).toBe("InvalidHexString@1-7");
      expect(outcome("{1: h'abc'}")).toBe("InvalidHexString@4-10");
      expect(outcome("1(h'abc')")).toBe("InvalidHexString@2-8");
    });

    it("reports ExpectedComma and UnmatchedParentheses before naming a literal's error", () => {
      expect(outcome("[1 h'abc']")).toBe("ExpectedComma@3-9");
      expect(outcome("{1: 2 h'abc'}")).toBe("ExpectedComma@6-12");
      expect(outcome("1(1 h'abc')")).toBe("UnmatchedParentheses@4-10");
      expect(outcome("date(1 h'abc')")).toBe("UnmatchedParentheses@7-13");
      expect(outcome("{1 h'abc'}")).toBe("ExpectedColon@3-9");
    });

    it("spans an unknown known-value name with its quotes in an array and without elsewhere", () => {
      expect(outcome("['zzz']")).toBe("UnknownKnownValueName@1-6");
      expect(outcome("[1, 'zzz']")).toBe("UnknownKnownValueName@4-9");
      expect(outcome("'zzz'")).toBe("UnknownKnownValueName@1-4");
      expect(outcome("{'zzz': 1}")).toBe("UnknownKnownValueName@2-5");
    });
  });

  describe("error spans", () => {
    const outcome = (src: string): string => {
      const result = tryParseDcborItem(src);
      if (result.ok) return "ok";
      const { error } = result;
      return error.span === undefined
        ? error.code
        : `${error.code}@${error.span.start}-${error.span.end}`;
    };
    const consumed = (src: string): string => {
      const result = tryParseDcborItemPartial(src);
      return result.ok ? String(result.value.length) : result.error.code;
    };

    it("sit at the end of the source when the source ended", () => {
      expect(outcome("42(1")).toBe("UnmatchedParentheses@4-4");
      expect(outcome("{1")).toBe("ExpectedColon@2-2");
      expect(outcome('{"k"')).toBe("ExpectedColon@4-4");
      expect(outcome("{1: 2")).toBe("UnmatchedBraces@5-5");
      expect(outcome("{1: 2 ")).toBe("UnmatchedBraces@6-6");
      expect(outcome("{1: 2 /c/")).toBe("UnmatchedBraces@9-9");
      expect(outcome("{")).toBe("UnmatchedBraces@1-1");
    });

    it("cover an unrecognised identifier run", () => {
      expect(outcome("1_000")).toBe("ExtraData@1-5");
      expect(outcome("0x10")).toBe("ExtraData@1-4");
      expect(outcome("-Infinityzz")).toBe("ExtraData@9-11");
      expect(outcome("1 truex")).toBe("ExtraData@2-7");
      expect(outcome("{1 truex}")).toBe("ExpectedColon@3-8");
      expect(outcome("[1 truex]")).toBe("UnrecognizedToken@1-2");
    });

    it("cover a whitespace run that ends in an unterminated comment, from its start", () => {
      expect(outcome("1 /x")).toBe("ExtraData@1-4");
      expect(outcome("{1 /x}")).toBe("ExpectedColon@2-6");
      expect(consumed("1 /unterminated")).toBe("1");
      expect(consumed("1 \t/")).toBe("1");
      expect(consumed("1 /a/ /b")).toBe("1");
      expect(consumed("1 /a/")).toBe("5");
      expect(outcome("/x 1")).toBe("UnrecognizedToken@0-0");
    });

    it("treat a hex or base64 literal that fails its pattern as unrecognised text", () => {
      expect(outcome("h'zz'")).toBe("UnrecognizedToken@0-0");
      expect(outcome("h'")).toBe("UnrecognizedToken@0-0");
      expect(outcome("[1, h'zz']")).toBe("UnrecognizedToken@2-3");
      expect(outcome("1 h'zz'")).toBe("ExtraData@2-3");
      expect(outcome("b64'A'")).toBe("UnrecognizedToken@0-0");
      expect(outcome("b64''")).toBe("UnrecognizedToken@0-0");
      expect(outcome("[b64'']")).toBe("UnrecognizedToken@0-1");
      expect(outcome("h'abc'")).toBe("InvalidHexString@0-6");
      expect(outcome("b64'QR=='")).toBe("InvalidBase64String@0-9");
    });

    it("reject a date literal with non-ASCII digits as a date", () => {
      expect(outcome("٢٠٢٣-01-01")).toBe("InvalidDateString@0-10");
      expect(outcome("2023-01-0١")).toBe("InvalidDateString@0-10");
      expect(outcome("[2023-01-0١]")).toBe("UnexpectedToken@1-11");
      expect(outcome("1١")).toBe("ExtraData@1-2");
    });
  });

  describe("whitespace and comments", () => {
    it("should handle multiline whitespace", () => {
      const src = `{
  "Hello":
      "World"
}`;
      const result = tryParseDcborItem(src);
      expect(result.ok).toBe(true);
    });

    it("should handle inline comments", () => {
      const src = "/this is a comment/ [1, /ignore me/ 2, 3]";
      const result = tryParseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("[1, 2, 3]");
      }
    });

    it("should handle end-of-line comments", () => {
      const src = "[1, 2, 3] # this should be ignored";
      const result = tryParseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("[1, 2, 3]");
      }
    });
  });

  describe("partial parsing", () => {
    it("should parse partial input", () => {
      const result = tryParseDcborItemPartial("true )");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const { value: cborValue, length: used } = result.value;
        expect(diagnostic(cborValue)).toBe("true");
        expect(used).toBe(5);
      }
    });

    it("should handle trailing whitespace in partial", () => {
      const src = "false  # comment\n";
      const result = tryParseDcborItemPartial(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const { value: cborValue, length: used } = result.value;
        expect(diagnostic(cborValue)).toBe("false");
        expect(used).toBe(src.length);
      }
    });
  });

  describe("date literals", () => {
    it("should parse simple dates", () => {
      const result = tryParseDcborItem("2023-02-08");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should be a tagged date value
        expect(diagnostic(result.value)).toMatch(/^\d+\(/);
      }
    });

    it("should parse date-time", () => {
      const result = tryParseDcborItem("2023-02-08T15:30:45Z");
      expect(result.ok).toBe(true);
    });

    it("should parse array of dates", () => {
      const result = tryParseDcborItem("[1965-05-15, 2000-07-25, 2004-10-30]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Dates should be tagged, not quoted strings
        const diag = diagnostic(result.value);
        expect(diag).not.toContain('"');
      }
    });
  });

  describe("duplicate map keys", () => {
    it("should error on duplicate string keys", () => {
      const result = tryParseDcborItem('{"key1": 1, "key2": 2, "key1": 3}');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DuplicateMapKey");
      }
    });

    it("should error on duplicate integer keys", () => {
      const result = tryParseDcborItem('{1: "value1", 2: "value2", 1: "value3"}');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DuplicateMapKey");
      }
    });

    it("should allow non-duplicate keys", () => {
      const result = tryParseDcborItem('{"key1": 1, "key2": 2, "key3": 3}');
      expect(result.ok).toBe(true);
    });

    it("should error on duplicate key with correct location", () => {
      const input = '{"key1": 1, "key2": 2, "key1": 3}';
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DuplicateMapKey");
        // Verify the error message can be formatted
        const fullMsg = result.error.fullMessage(input);
        expect(fullMsg).toContain("Duplicate map key");
        expect(fullMsg).toContain("^"); // Should show caret pointing to the error
      }
    });
  });

  describe("UR parsing", () => {
    it("should parse UR strings", () => {
      // Create a date UR - use untaggedCbor() since parseUr adds the tag wrapper
      const date = CborDate.fromYmd(2025, 5, 15);
      const ur = UR.from("date", date.untaggedCbor());
      const urString = ur.toString();
      expect(urString).toMatch(/^ur:date\//);

      const result = tryParseDcborItem(urString);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // The parsed result should match the tagged date CBOR
        expect(diagnostic(result.value)).toBe(diagnostic(date.toCbor()));
      }
    });

    it("should error on unknown UR type", () => {
      const result = tryParseDcborItem("ur:foobar/cyisdadmlasgtapttl");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UnknownUrType");
      }
    });

    it("should error on invalid UR", () => {
      // Invalid checksum (last character changed)
      const result = tryParseDcborItem("ur:date/cyisdadmlasgtapttx");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidUr");
      }
    });
  });

  describe("named tags", () => {
    it("should parse named tag (date)", () => {
      const date = CborDate.fromYmd(2025, 5, 15);
      const dateCbor = date.toCbor();
      // Replace numeric tag with name: '1(' -> 'date('
      const dateDiag = diagnostic(dateCbor).replace("1(", "date(");
      const result = tryParseDcborItem(dateDiag);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe(diagnostic(dateCbor));
      }
    });
  });

  describe("nested structures", () => {
    it("should parse complex nested structures", () => {
      // Nested array with tagged values, arrays, and maps
      const nested = cbor([
        taggedValue(1234, cbor(new Uint8Array([0x01, 0x02, 0x03]))),
        cbor([cbor(1), cbor(2), cbor(3)]),
        (() => {
          const map = new CborMap();
          map.set(cbor("key1"), cbor("value1"));
          map.set(cbor("key2"), cbor([cbor(4), cbor(5), cbor(6)]));
          return cbor(map);
        })(),
      ]);
      roundtrip(nested);
    });
  });

  describe("additional whitespace", () => {
    it("should handle whitespace variant 2", () => {
      const src = `{"Hello":
"World"}`;
      const result = tryParseDcborItem(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const map = new CborMap();
        map.set(cbor("Hello"), cbor("World"));
        expect(diagnostic(result.value)).toBe(diagnostic(cbor(map)));
      }
    });
  });

  describe("additional error cases", () => {
    it("should error on expected comma in map", () => {
      const result = tryParseDcborItem("{1: 2 3: 4}");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedComma");
      }
    });

    it("should error on invalid known value (very large number)", () => {
      const result = tryParseDcborItem("'20000000000000000000'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidKnownValue");
      }
    });
  });

  describe("date extended tests", () => {
    it("should parse date with timezone offset", () => {
      const result = tryParseDcborItem("2023-02-08T15:30:45+01:00");
      expect(result.ok).toBe(true);
    });

    it("should parse date with negative timezone offset", () => {
      const result = tryParseDcborItem("2023-02-08T15:30:45-08:00");
      expect(result.ok).toBe(true);
    });

    it("should parse date with milliseconds", () => {
      const result = tryParseDcborItem("2023-02-08T15:30:45.123Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-02-08T15:30:45.123Z");
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should parse date in map", () => {
      const result = tryParseDcborItem('{"start": 2023-01-01, "end": 2023-12-31}');
      expect(result.ok).toBe(true);
    });

    it("should parse nested structure with dates", () => {
      const result = tryParseDcborItem(
        '{"events": [2023-01-01T00:00:00Z, 2023-06-15T12:30:00Z], "metadata": {"created": 2023-02-08}}',
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("date vs number precedence", () => {
    it("should parse pure number as number", () => {
      const result = tryParseDcborItem("2023");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("2023");
      }
    });

    it("should parse date format as date", () => {
      const result = tryParseDcborItem("2023-01-01");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromYmd(2023, 1, 1);
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should produce different results for number and date", () => {
      const numberResult = tryParseDcborItem("2023");
      const dateResult = tryParseDcborItem("2023-01-01");
      expect(numberResult.ok).toBe(true);
      expect(dateResult.ok).toBe(true);
      if (numberResult.ok && dateResult.ok) {
        expect(diagnostic(numberResult.value)).not.toBe(diagnostic(dateResult.value));
      }
    });
  });
});

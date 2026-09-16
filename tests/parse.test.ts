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
import { tryParseDcbor, tryParseDcborPrefix } from "../src/parse";
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
  const result = tryParseDcbor(src);
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
      const result = tryParseDcbor(hex);
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
      const result = tryParseDcbor(base64);
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
      const result = tryParseDcbor(src);
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
      const result = tryParseDcbor(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe(diagnostic(cborValue));
      }
    });

    it("should parse known value with single quotes", () => {
      const v = IS_A;
      const cborValue = v.toCbor();

      // Test '1'
      const result2 = tryParseDcbor("'1'");
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(diagnostic(result2.value)).toBe(diagnostic(cborValue));
      }

      // Test 'isA'
      const result3 = tryParseDcbor("'isA'");
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
        const result = tryParseDcbor(test);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(diagnostic(result.value)).toBe(diagnostic(cborValue));
        }
      }
    });
  });

  describe("errors", () => {
    function checkError(source: string, expectedType: DcborParseErrorCode): void {
      const result = tryParseDcbor(source);
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

  describe("whitespace and comments", () => {
    it("should handle multiline whitespace", () => {
      const src = `{
  "Hello":
      "World"
}`;
      const result = tryParseDcbor(src);
      expect(result.ok).toBe(true);
    });

    it("should handle inline comments", () => {
      const src = "/this is a comment/ [1, /ignore me/ 2, 3]";
      const result = tryParseDcbor(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("[1, 2, 3]");
      }
    });

    it("should handle end-of-line comments", () => {
      const src = "[1, 2, 3] # this should be ignored";
      const result = tryParseDcbor(src);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("[1, 2, 3]");
      }
    });
  });

  describe("partial parsing", () => {
    it("should parse partial input", () => {
      const result = tryParseDcborPrefix("true )");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const { value: cborValue, length: used } = result.value;
        expect(diagnostic(cborValue)).toBe("true");
        expect(used).toBe(5);
      }
    });

    it("should handle trailing whitespace in partial", () => {
      const src = "false  # comment\n";
      const result = tryParseDcborPrefix(src);
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
      const result = tryParseDcbor("2023-02-08");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should be a tagged date value
        expect(diagnostic(result.value)).toMatch(/^\d+\(/);
      }
    });

    it("should parse date-time", () => {
      const result = tryParseDcbor("2023-02-08T15:30:45Z");
      expect(result.ok).toBe(true);
    });

    it("should parse array of dates", () => {
      const result = tryParseDcbor("[1965-05-15, 2000-07-25, 2004-10-30]");
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
      const result = tryParseDcbor('{"key1": 1, "key2": 2, "key1": 3}');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DuplicateMapKey");
      }
    });

    it("should error on duplicate integer keys", () => {
      const result = tryParseDcbor('{1: "value1", 2: "value2", 1: "value3"}');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("DuplicateMapKey");
      }
    });

    it("should allow non-duplicate keys", () => {
      const result = tryParseDcbor('{"key1": 1, "key2": 2, "key3": 3}');
      expect(result.ok).toBe(true);
    });

    it("should error on duplicate key with correct location", () => {
      const input = '{"key1": 1, "key2": 2, "key1": 3}';
      const result = tryParseDcbor(input);
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

      const result = tryParseDcbor(urString);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // The parsed result should match the tagged date CBOR
        expect(diagnostic(result.value)).toBe(diagnostic(date.toCbor()));
      }
    });

    it("should error on unknown UR type", () => {
      const result = tryParseDcbor("ur:foobar/cyisdadmlasgtapttl");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UnknownUrType");
      }
    });

    it("should error on invalid UR", () => {
      // Invalid checksum (last character changed)
      const result = tryParseDcbor("ur:date/cyisdadmlasgtapttx");
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
      const result = tryParseDcbor(dateDiag);
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
      const result = tryParseDcbor(src);
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
      const result = tryParseDcbor("{1: 2 3: 4}");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("ExpectedComma");
      }
    });

    it("should error on invalid known value (very large number)", () => {
      const result = tryParseDcbor("'20000000000000000000'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("InvalidKnownValue");
      }
    });
  });

  describe("date extended tests", () => {
    it("should parse date with timezone offset", () => {
      const result = tryParseDcbor("2023-02-08T15:30:45+01:00");
      expect(result.ok).toBe(true);
    });

    it("should parse date with negative timezone offset", () => {
      const result = tryParseDcbor("2023-02-08T15:30:45-08:00");
      expect(result.ok).toBe(true);
    });

    it("should parse date with milliseconds", () => {
      const result = tryParseDcbor("2023-02-08T15:30:45.123Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-02-08T15:30:45.123Z");
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should parse date in map", () => {
      const result = tryParseDcbor('{"start": 2023-01-01, "end": 2023-12-31}');
      expect(result.ok).toBe(true);
    });

    it("should parse nested structure with dates", () => {
      const result = tryParseDcbor(
        '{"events": [2023-01-01T00:00:00Z, 2023-06-15T12:30:00Z], "metadata": {"created": 2023-02-08}}',
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("date vs number precedence", () => {
    it("should parse pure number as number", () => {
      const result = tryParseDcbor("2023");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("2023");
      }
    });

    it("should parse date format as date", () => {
      const result = tryParseDcbor("2023-01-01");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromYmd(2023, 1, 1);
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should produce different results for number and date", () => {
      const numberResult = tryParseDcbor("2023");
      const dateResult = tryParseDcbor("2023-01-01");
      expect(numberResult.ok).toBe(true);
      expect(dateResult.ok).toBe(true);
      if (numberResult.ok && dateResult.ok) {
        expect(diagnostic(numberResult.value)).not.toBe(diagnostic(dateResult.value));
      }
    });
  });
});

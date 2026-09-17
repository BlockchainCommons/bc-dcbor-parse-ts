/**
 * Runtime functionality tests: the reference suite's end-to-end cases.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  cbor,
  CborDate,
  asBytes,
  asText,
  expectArray,
  expectMap,
  getGlobalTagsStore,
} from "@blockchaincommons/dcbor";
import { registerTags } from "@blockchaincommons/tags";
import { tryParseDcborItem } from "../src/parse";
import { diagnostic } from "@blockchaincommons/dcbor/diagnostic";

// Register tags before running tests
beforeAll(() => {
  registerTags(getGlobalTagsStore());
});

describe("runtime functionality", () => {
  describe("basic functionality preserved", () => {
    it("should parse basic string", () => {
      const result = tryParseDcborItem('"Hello, World!"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe('"Hello, World!"');
      }
    });

    it("should parse empty string", () => {
      const result = tryParseDcborItem('""');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe('""');
      }
    });

    it("should parse hex string", () => {
      const result = tryParseDcborItem("h'deadbeef'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("h'deadbeef'");
      }
    });

    it("should parse empty hex string", () => {
      const result = tryParseDcborItem("h''");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(diagnostic(result.value)).toBe("h''");
      }
    });

    it("should parse basic base64", () => {
      const result = tryParseDcborItem("b64'SGVsbG8='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // "Hello" in base64
        const bytes = asBytes(result.value);
        expect(bytes).toEqual(new TextEncoder().encode("Hello"));
      }
    });

    it("should parse date (date only)", () => {
      const result = tryParseDcborItem("2023-12-25");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromYmd(2023, 12, 25);
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should parse basic array", () => {
      const result = tryParseDcborItem("[\"hello\", h'dead', 42]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const arr = expectArray(result.value);
        expect(arr.length).toBe(3);
        expect(diagnostic(arr[0])).toBe('"hello"');
        expect(diagnostic(arr[1])).toBe("h'dead'");
        expect(diagnostic(arr[2])).toBe("42");
      }
    });

    it("should parse basic map", () => {
      const result = tryParseDcborItem('{"key": "value", "number": 123}');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const map = expectMap(result.value);
        expect(map.has(cbor("key"))).toBe(true);
        expect(map.has(cbor("number"))).toBe(true);
      }
    });
  });

  describe("basic patterns compilation", () => {
    it("should parse all basic token types", () => {
      const inputs = [
        '"simple"',
        "h'ff'",
        "b64'QUE='",
        "2023-01-01",
        "42",
        "true",
        "false",
        "null",
        "[1, 2, 3]",
        '{"a": 1}',
      ];

      for (const input of inputs) {
        const result = tryParseDcborItem(input);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("hex parsing comprehensive", () => {
    it("should parse empty hex string", () => {
      const result = tryParseDcborItem("h''");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([]));
      }
    });

    it("should parse single byte hex", () => {
      const result = tryParseDcborItem("h'FF'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xff]));
      }
    });

    it("should parse lowercase hex", () => {
      const result = tryParseDcborItem("h'deadbeef'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      }
    });

    it("should parse uppercase hex", () => {
      const result = tryParseDcborItem("h'DEADBEEF'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      }
    });

    it("should parse mixed case hex", () => {
      const result = tryParseDcborItem("h'DeAdBeEf'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      }
    });
  });

  describe("complex string escapes", () => {
    it("should parse string with escaped quotes", () => {
      const result = tryParseDcborItem('"She said \\"Hello\\""');
      expect(result.ok).toBe(true);
      if (result.ok) {
        // The parser stores literal escape sequences
        const text = asText(result.value);
        expect(text).toBe('She said \\"Hello\\"');
      }
    });

    it("should parse string with backslash escapes", () => {
      const result = tryParseDcborItem('"Path\\\\to\\\\file"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const text = asText(result.value);
        expect(text).toBe("Path\\\\to\\\\file");
      }
    });

    it("should parse string with escape sequences", () => {
      const result = tryParseDcborItem('"Line 1\\nLine 2\\tTabbed"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Parser stores literal backslash-n, not newline
        const text = asText(result.value);
        expect(text).toContain("\\n");
        expect(text).toContain("\\t");
      }
    });

    it("should parse string with unicode escapes", () => {
      const result = tryParseDcborItem('"Unicode: \\u0041\\u0042\\u0043"');
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Parser stores literal unicode escapes
        const text = asText(result.value);
        expect(text).toContain("\\u0041");
      }
    });

    it("should parse valid escape sequence", () => {
      const result = tryParseDcborItem('"Valid escape: \\""');
      expect(result.ok).toBe(true);
    });

    it("should parse valid unicode escape", () => {
      const result = tryParseDcborItem('"Valid unicode: \\u1234"');
      expect(result.ok).toBe(true);
    });
  });

  describe("complex date formats", () => {
    it("should parse date with timezone Z", () => {
      const result = tryParseDcborItem("2023-12-25T10:30:45Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45Z");
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should parse date with positive timezone offset", () => {
      const result = tryParseDcborItem("2023-12-25T10:30:45+05:30");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45+05:30");
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should parse date with negative timezone offset", () => {
      const result = tryParseDcborItem("2023-12-25T10:30:45-08:00");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45-08:00");
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should parse date with milliseconds", () => {
      const result = tryParseDcborItem("2023-12-25T10:30:45.123Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = CborDate.fromString("2023-12-25T10:30:45.123Z");
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
      }
    });

    it("should parse date with microseconds", () => {
      const result = tryParseDcborItem("2023-12-25T10:30:45.123456Z");
      expect(result.ok).toBe(true);
      if (result.ok) {
        // the microseconds are kept exactly
        const expected = CborDate.fromString("2023-12-25T10:30:45.123456Z");
        expect(diagnostic(result.value)).toBe(diagnostic(expected.toCbor()));
        expect(expected.epochSeconds).toBe(1703500245 + 123_456_000 / 1_000_000_000);
      }
    });
  });

  describe("base64 requirements", () => {
    it("should parse base64 with minimum 2-character requirement", () => {
      const result = tryParseDcborItem("b64'QQ=='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new Uint8Array([0x41])); // 'A'
      }
    });

    it("should parse longer base64 strings", () => {
      const result = tryParseDcborItem("b64'SGVsbG8gV29ybGQ='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new TextEncoder().encode("Hello World"));
      }
    });

    it("should parse base64 without padding", () => {
      const result = tryParseDcborItem("b64'SGVsbG8='");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(asBytes(result.value)).toEqual(new TextEncoder().encode("Hello"));
      }
    });
  });

  describe("complex mixed patterns", () => {
    it("should parse complex array with various types", () => {
      const complexArray = `[
        "String with \\"quotes\\" and \\\\n newlines",
        h'deadbeef',
        b64'SGVsbG8gV29ybGQ=',
        2023-12-25T10:30:45.123Z,
        "Unicode: \\\\u0041\\\\u0042\\\\u0043"
      ]`;

      const result = tryParseDcborItem(complexArray);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const array = expectArray(result.value);
        expect(array.length).toBe(5);

        // Verify hex bytes
        expect(asBytes(array[1])).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));

        // Verify base64 bytes
        expect(asBytes(array[2])).toEqual(new TextEncoder().encode("Hello World"));

        // Verify date
        const expectedDate = CborDate.fromString("2023-12-25T10:30:45.123Z");
        expect(diagnostic(array[3])).toBe(diagnostic(expectedDate.toCbor()));
      }
    });

    it("should parse complex map with various types", () => {
      const complexMap = `{
        "message": "Hello \\"World\\" with \\n newlines",
        "data": h'0123456789abcdef',
        "timestamp": 2023-12-25T10:30:45-08:00
      }`;

      const result = tryParseDcborItem(complexMap);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const map = expectMap(result.value);
        expect(map.has(cbor("message"))).toBe(true);
        expect(map.has(cbor("data"))).toBe(true);
        expect(map.has(cbor("timestamp"))).toBe(true);
      }
    });
  });

  describe("base64 minimum length enforcement", () => {
    it("should reject empty base64 as unrecognised text", () => {
      const result = tryParseDcborItem("b64''");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UnrecognizedToken");
      }
    });

    it("should reject single character base64 as unrecognised text", () => {
      const result = tryParseDcborItem("b64'A'");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UnrecognizedToken");
      }
    });
  });

  describe("date with fractional seconds", () => {
    it("should parse date with fractional seconds", () => {
      const result = tryParseDcborItem("2023-12-25T12:30:45.123Z");
      expect(result.ok).toBe(true);
    });
  });

  describe("date with timezone offset", () => {
    it("should parse date with timezone offset", () => {
      const result = tryParseDcborItem("2023-12-25T12:30:45+05:30");
      expect(result.ok).toBe(true);
    });
  });

  describe("string with control characters rejected", () => {
    it("should reject strings with control characters", () => {
      // String containing control character \x01
      const input = '"hello\x01world"';
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(false);
    });
  });

  describe("string with unescaped quotes rejected", () => {
    it("should reject strings with unescaped quotes", () => {
      // Contains unescaped quote in middle
      const input = '"hello"world"';
      const result = tryParseDcborItem(input);
      expect(result.ok).toBe(false);
    });
  });

  describe("runtime pattern validation", () => {
    it("should validate complex date with microseconds and timezone", () => {
      const result = tryParseDcborItem("2023-12-25T10:30:45.123456Z");
      expect(result.ok).toBe(true);
    });

    it("should validate string with valid escape sequences", () => {
      const result = tryParseDcborItem('"line1\\nline2\\ttab\\u0041end"');
      expect(result.ok).toBe(true);
    });

    it("should validate proper base64", () => {
      const result = tryParseDcborItem("b64'SGVsbG8gV29ybGQ='");
      expect(result.ok).toBe(true);
    });

    it("should validate complex mixed input", () => {
      const complexInput = `{
        "message": "Hello\\nWorld",
        "data": b64'SGVsbG8=',
        "timestamp": 2023-12-25T10:30:45.123Z,
        "binary": h'deadbeef'
      }`;
      const result = tryParseDcborItem(complexInput);
      expect(result.ok).toBe(true);
    });
  });
});

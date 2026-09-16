/**
 * The `/lexer` subpath: every token kind with its span, iteration, and the
 * three ways the lexer rejects text.
 */
import { describe, it, expect } from "vitest";
import { Lexer, type Token } from "../src/lexer";
import { DcborParseError } from "../src";

const tokens = (src: string): Token[] => [...new Lexer(src)];
const kinds = (src: string): string[] => tokens(src).map((t) => t.type);

describe("lexer", () => {
  it("yields every token kind with its span", () => {
    const src = `true false null NaN Infinity -Infinity Unit { } [ ] ( ) : , h'ff' b64'QQ==' 2023-01-01 42 -1.5e3 "hi" 40(  date( '7' 'isA' '' ur:date/cyisdadmlasgtapttl`;
    const ts = tokens(src);
    expect(ts.map((t) => t.type)).toEqual([
      "Bool",
      "Bool",
      "Null",
      "NaN",
      "Infinity",
      "NegInfinity",
      "Unit",
      "BraceOpen",
      "BraceClose",
      "BracketOpen",
      "BracketClose",
      "ParenthesisOpen",
      "ParenthesisClose",
      "Colon",
      "Comma",
      "ByteStringHex",
      "ByteStringBase64",
      "DateLiteral",
      "Number",
      "Number",
      "String",
      "TagValue",
      "TagName",
      "KnownValueNumber",
      "KnownValueName",
      "KnownValueName",
      "UR",
    ]);
    for (const t of ts) {
      expect(src.slice(t.span.start, t.span.end).trim()).toBe(src.slice(t.span.start, t.span.end));
      expect(t.span.end).toBeGreaterThan(t.span.start);
      expect(Object.isFrozen(t)).toBe(true);
    }
    expect(ts[0]).toMatchObject({ type: "Bool", value: true, span: { start: 0, end: 4 } });
    expect(ts[20]).toMatchObject({ type: "String", value: "hi" });
    expect(ts[21]).toMatchObject({ type: "TagValue", value: 40 });
    expect(ts[22]).toMatchObject({ type: "TagName", value: "date" });
    expect(ts[23]).toMatchObject({ type: "KnownValueNumber", value: 7 });
    expect(ts[24]).toMatchObject({ type: "KnownValueName", value: "isA" });
    expect(ts[25]).toMatchObject({ type: "KnownValueName", value: "" });
  });

  it("holds a string's content without its quotes and keeps escapes as written", () => {
    expect(tokens('"a\\"b"')[0]).toMatchObject({ type: "String", value: 'a\\"b' });
    expect(tokens('""')[0]).toMatchObject({ type: "String", value: "" });
  });

  it("widens tag values and known-value numbers beyond 2^53 to bigint", () => {
    expect(tokens("18446744073709551615(")[0]).toMatchObject({ value: 18446744073709551615n });
    expect(tokens("'9007199254740993'")[0]).toMatchObject({ value: 9007199254740993n });
    expect(tokens("9007199254740991(")[0]).toMatchObject({ value: 9007199254740991 });
  });

  it("skips whitespace and both comment forms", () => {
    expect(kinds(" \t\r\n\f1 /c/ 2 // 3 # to the end\n4")).toEqual([
      "Number",
      "Number",
      "Number",
      "Number",
    ]);
  });

  it("supports next() as a pull interface and reports the last span", () => {
    const lexer = new Lexer("[1]");
    expect(lexer.next()?.type).toBe("BracketOpen");
    expect(lexer.next()?.type).toBe("Number");
    expect(lexer.span).toEqual({ start: 1, end: 2 });
    expect(lexer.slice).toBe("1");
    expect(lexer.next()?.type).toBe("BracketClose");
    expect(lexer.next()).toBeUndefined();
  });

  it("lexes a keyword before `(` as a tag name", () => {
    expect(tokens("true(1)")[0]).toMatchObject({ type: "TagName", value: "true" });
    expect(kinds("-Infinity(1)")).toEqual([
      "NegInfinity",
      "ParenthesisOpen",
      "Number",
      "ParenthesisClose",
    ]);
    expect(kinds("true (1)")).toEqual(["Bool", "ParenthesisOpen", "Number", "ParenthesisClose"]);
  });

  it("rejects unrecognised text at the character that stopped it", () => {
    const lexer = new Lexer("1 @");
    lexer.next();
    let error: unknown;
    try {
      lexer.next();
    } catch (e) {
      error = e;
    }
    expect(DcborParseError.isDcborParseError(error) && error.code).toBe("UnrecognizedToken");
    expect((error as DcborParseError).span).toEqual({ start: 2, end: 3 });
  });

  it("rejects a malformed literal with its own code over the literal", () => {
    const codeOf = (src: string): string => {
      try {
        tokens(src);
        return "ok";
      } catch (e) {
        return DcborParseError.isDcborParseError(e)
          ? `${e.code}@${e.span?.start}-${e.span?.end}`
          : "?";
      }
    };
    expect(codeOf("h'abc'")).toBe("InvalidHexString@0-6");
    expect(codeOf("h'ab")).toBe("InvalidHexString@0-4");
    expect(codeOf("b64'QR=='")).toBe("InvalidBase64String@0-9");
    expect(codeOf("b64'QQ'")).toBe("InvalidBase64String@0-7");
    expect(codeOf("2023-02-30")).toBe("InvalidDateString@0-10");
    expect(codeOf("18446744073709551616(")).toBe("InvalidTagValue@0-20");
    expect(codeOf("'18446744073709551616'")).toBe("InvalidKnownValue@1-21");
    expect(codeOf("ur:date/cyisdadmlasgtapttx")).toBe("InvalidUr@0-26");
    expect(codeOf('"unterminated')).toBe("UnrecognizedToken@0-1");
    expect(codeOf("'a b'")).toBe("UnrecognizedToken@0-1");
  });

  it("decodes canonical base64 only", () => {
    const bytes = (src: string): string => {
      const t = tokens(src)[0];
      return t.type === "ByteStringBase64" ? Buffer.from(t.value).toString("hex") : t.type;
    };
    expect(bytes("b64'QQ=='")).toBe("41");
    expect(bytes("b64'QUI='")).toBe("4142");
    expect(bytes("b64'QUJD'")).toBe("414243");
    expect(bytes("b64'SGVsbG8gV29ybGQ='")).toBe("48656c6c6f20576f726c64");
    for (const bad of ["QR==", "QUJ=", "Q===", "QQ=", "====", "QQ==QQ==", "QQ-=", "QUJDQ"]) {
      expect(() => tokens(`b64'${bad}'`), bad).toThrow(DcborParseError);
    }
  });
});

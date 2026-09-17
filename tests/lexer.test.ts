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
    expect(ts[20]).toMatchObject({ type: "String", value: '"hi"' });
    expect(ts[21]).toMatchObject({ type: "TagValue", value: { ok: true, value: 40 } });
    expect(ts[22]).toMatchObject({ type: "TagName", value: "date" });
    expect(ts[23]).toMatchObject({ type: "KnownValueNumber", value: { ok: true, value: 7 } });
    expect(ts[24]).toMatchObject({ type: "KnownValueName", value: "isA" });
    expect(ts[25]).toMatchObject({ type: "KnownValueName", value: "" });
  });

  it("holds a string's source text with its quotes and keeps escapes as written", () => {
    expect(tokens('"a\\"b"')[0]).toMatchObject({ type: "String", value: '"a\\"b"' });
    expect(tokens('""')[0]).toMatchObject({ type: "String", value: '""' });
  });

  it("widens tag values and known-value numbers beyond 2^53 to bigint", () => {
    const valueOf = (src: string): unknown => {
      const t = tokens(src)[0];
      return "value" in t && typeof t.value === "object" && "ok" in t.value && t.value.ok
        ? t.value.value
        : undefined;
    };
    expect(valueOf("18446744073709551615(")).toBe(18446744073709551615n);
    expect(valueOf("'9007199254740993'")).toBe(9007199254740993n);
    expect(valueOf("9007199254740991(")).toBe(9007199254740991);
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

  it("carries a malformed literal's error in the token", () => {
    const payloadOf = (src: string): string => {
      const t = tokens(src)[0];
      const value = "value" in t ? t.value : undefined;
      if (typeof value === "object" && value !== null && "ok" in value && !value.ok) {
        return `${t.type}:${value.error.code}@${value.error.span?.start}-${value.error.span?.end}`;
      }
      return t.type;
    };
    expect(payloadOf("h'abc'")).toBe("ByteStringHex:InvalidHexString@0-6");
    expect(payloadOf("b64'QR=='")).toBe("ByteStringBase64:InvalidBase64String@0-9");
    expect(payloadOf("b64'QQ'")).toBe("ByteStringBase64:InvalidBase64String@0-7");
    expect(payloadOf("2023-02-30")).toBe("DateLiteral:InvalidDateString@0-10");
    expect(payloadOf("18446744073709551616(")).toBe("TagValue:InvalidTagValue@0-20");
    expect(payloadOf("'18446744073709551616'")).toBe("KnownValueNumber:InvalidKnownValue@1-21");
    expect(payloadOf("ur:date/cyisdadmlasgtapttx")).toBe("UR:InvalidUr@0-26");
    expect(payloadOf("h'ab'")).toBe("ByteStringHex");
    expect(payloadOf("40(")).toBe("TagValue");
  });

  it("rejects text no token matches, quoted literals included, at its start", () => {
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
    expect(codeOf('"unterminated')).toBe("UnrecognizedToken@0-1");
    expect(codeOf("'a b'")).toBe("UnrecognizedToken@0-1");
    // A hex or base64 literal that does not match its pattern is not a token.
    expect(codeOf("h'zz'")).toBe("UnrecognizedToken@0-1");
    expect(codeOf("h'ab")).toBe("UnrecognizedToken@0-1");
    expect(codeOf("h'")).toBe("UnrecognizedToken@0-1");
    expect(codeOf("b64'A'")).toBe("UnrecognizedToken@0-3");
    expect(codeOf("b64''")).toBe("UnrecognizedToken@0-3");
    expect(codeOf("b64'QQ =='")).toBe("UnrecognizedToken@0-3");
  });

  it("spans unrecognised text as a scanner reads it", () => {
    const missOf = (src: string): string => {
      const lexer = new Lexer(src);
      try {
        for (;;) if (lexer.next() === undefined) return "ok";
      } catch (e) {
        return DcborParseError.isDcborParseError(e)
          ? `${e.code}@${e.span?.start}-${e.span?.end}`
          : "?";
      }
    };
    // an identifier run
    expect(missOf("1 truex")).toBe("UnrecognizedToken@2-7");
    expect(missOf("1 _a-b9")).toBe("UnrecognizedToken@2-7");
    expect(missOf("1_000")).toBe("UnrecognizedToken@1-5");
    expect(missOf("1 b64'A'")).toBe("UnrecognizedToken@2-5");
    // a whitespace run ending in an unterminated comment, from its start
    expect(missOf("1 \t/x")).toBe("UnrecognizedToken@1-5");
    expect(missOf("1 /a/ /b")).toBe("UnrecognizedToken@1-8");
    expect(missOf("1/x")).toBe("UnrecognizedToken@1-3");
    // one code point otherwise
    expect(missOf("1 @")).toBe("UnrecognizedToken@2-3");
    expect(missOf("1 🌈")).toBe("UnrecognizedToken@2-4");
    expect(missOf("1 'a ")).toBe("UnrecognizedToken@2-3");
  });

  it("reports an empty span at the end of the source", () => {
    const lexer = new Lexer("[1]  /c/ ");
    while (lexer.next() !== undefined);
    expect(lexer.span).toEqual({ start: 9, end: 9 });
    expect(lexer.slice).toBe("");
  });

  it("lexes a date literal with any decimal digits and carries the date parser's rejection", () => {
    const lexer = new Lexer("٢٠٢٣-01-01");
    const t = lexer.next();
    expect(t?.type).toBe("DateLiteral");
    expect(t?.type === "DateLiteral" && !t.value.ok && t.value.error.code).toBe(
      "InvalidDateString",
    );
    expect(t?.span).toEqual({ start: 0, end: 10 });
    expect(lexer.next()).toBeUndefined();
    expect(new Lexer("1١").next()?.type).toBe("Number");
  });

  it("decodes canonical base64 only", () => {
    const bytes = (src: string): string => {
      const t = new Lexer(src).next();
      if (t?.type !== "ByteStringBase64") return String(t?.type);
      return t.value.ok ? Buffer.from(t.value.value).toString("hex") : t.value.error.code;
    };
    expect(bytes("b64'QQ=='")).toBe("41");
    expect(bytes("b64'QUI='")).toBe("4142");
    expect(bytes("b64'QUJD'")).toBe("414243");
    expect(bytes("b64'SGVsbG8gV29ybGQ='")).toBe("48656c6c6f20576f726c64");
    for (const bad of ["QR==", "QUJ=", "Q===", "QQ=", "====", "QQ==QQ==", "QUJDQ"]) {
      expect(bytes(`b64'${bad}'`), bad).toBe("InvalidBase64String");
    }
    expect(() => bytes("b64'QQ-='")).toThrow(DcborParseError);
  });
});

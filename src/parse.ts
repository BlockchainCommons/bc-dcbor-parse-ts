/**
 * The parser: dCBOR diagnostic notation → `Cbor`.
 */
import {
  type Cbor,
  cbor,
  CborMap,
  getGlobalTagsStore,
  taggedValue,
  type ReadonlyTagsStore,
} from "@blockchaincommons/dcbor";
import {
  KnownValue,
  getGlobalKnownValuesStore,
  type KnownValuesStore,
} from "@blockchaincommons/known-values";
import type { UR } from "@blockchaincommons/uniform-resources";
import { type Span, span, DcborParseError, type DcborResult } from "./error";
import { type Token, Lexer } from "./token";

/** Where tag names and known-value names resolve; the global stores by default. */
export interface ParseOptions {
  tags?: ReadonlyTagsStore;
  knownValues?: KnownValuesStore;
}

/** A parsed prefix: the item and how many UTF-16 code units of the source it took. */
export interface ParsedPrefix {
  readonly value: Cbor;
  readonly length: number;
}

/**
 * Parses one dCBOR item from `src`, which must contain nothing else but
 * whitespace and comments.
 *
 * @throws {DcborParseError}
 */
export function parseDcbor(src: string, options: ParseOptions = {}): Cbor {
  const lexer = new Lexer(src);
  const first = expectFirstToken(lexer);
  const value = parseItemToken(first, lexer, options);
  if (hasMore(lexer)) {
    throw DcborParseError.extraData(lexer.span());
  }
  return value;
}

/** Whether anything but whitespace and comments follows; unrecognised text counts as more. */
function hasMore(lexer: Lexer): boolean {
  try {
    return lexer.next() !== undefined;
  } catch (e) {
    if (DcborParseError.isDcborParseError(e)) return true;
    throw e;
  }
}

/** `parseDcbor` as a `Result` instead of a throw. */
export function tryParseDcbor(
  src: string,
  options: ParseOptions = {},
): DcborResult<Cbor, DcborParseError> {
  try {
    return { ok: true, value: parseDcbor(src, options) };
  } catch (e) {
    if (DcborParseError.isDcborParseError(e)) return { ok: false, error: e };
    throw e;
  }
}

/**
 * Parses the first dCBOR item of `src` and reports how much of the source
 * it consumed, leaving the rest for the caller.
 *
 * @throws {DcborParseError}
 */
export function parseDcborPrefix(src: string, options: ParseOptions = {}): ParsedPrefix {
  const lexer = new Lexer(src);
  const first = expectFirstToken(lexer);
  const value = parseItemToken(first, lexer, options);
  const length = hasMore(lexer) ? lexer.span().start : src.length;
  return { value, length };
}

/** `parseDcborPrefix` as a `Result` instead of a throw. */
export function tryParseDcborPrefix(
  src: string,
  options: ParseOptions = {},
): DcborResult<ParsedPrefix, DcborParseError> {
  try {
    return { ok: true, value: parseDcborPrefix(src, options) };
  } catch (e) {
    if (DcborParseError.isDcborParseError(e)) return { ok: false, error: e };
    throw e;
  }
}

function expectFirstToken(lexer: Lexer): Token {
  try {
    return expectToken(lexer);
  } catch (e) {
    if (DcborParseError.isDcborParseError(e) && e.code === "UnexpectedEndOfInput") {
      throw DcborParseError.emptyInput();
    }
    throw e;
  }
}

function parseItem(lexer: Lexer, options: ParseOptions): Cbor {
  return parseItemToken(expectToken(lexer), lexer, options);
}

/** The next token; end of input and unrecognised text are errors. */
function expectToken(lexer: Lexer): Token {
  const spanBefore = lexer.span();
  let token: Token | undefined;
  try {
    token = lexer.next();
  } catch (e) {
    // An unrecognised token is reported at the previous token's span.
    if (DcborParseError.isDcborParseError(e) && e.code === "UnrecognizedToken") {
      throw DcborParseError.unrecognizedToken(spanBefore);
    }
    throw e;
  }
  if (token === undefined) {
    throw DcborParseError.unexpectedEndOfInput();
  }
  return token;
}

function parseItemToken(token: Token, lexer: Lexer, options: ParseOptions): Cbor {
  switch (token.type) {
    case "Bool":
      return cbor(token.value);
    case "Null":
      return cbor(null);
    case "ByteStringHex":
    case "ByteStringBase64":
      return cbor(token.value);
    case "DateLiteral":
      return cbor(token.value);
    case "Number":
      return cbor(token.value);
    case "NaN":
      return cbor(Number.NaN);
    case "Infinity":
      return cbor(Number.POSITIVE_INFINITY);
    case "NegInfinity":
      return cbor(Number.NEGATIVE_INFINITY);
    case "String":
      return parseString(token.value, lexer.span());
    case "UR":
      return parseUr(token.value, lexer.span(), options);
    case "TagValue":
      return parseNumberTag(token.value, lexer, options);
    case "TagName":
      return parseNameTag(token.value, lexer, options);
    case "KnownValueNumber":
      return new KnownValue(token.value).toCbor();
    case "KnownValueName": {
      if (token.value === "") {
        return new KnownValue(0).toCbor();
      }
      const knownValue = knownValueForName(token.value, options);
      if (knownValue !== undefined) {
        return knownValue.toCbor();
      }
      const tokenSpan = lexer.span();
      throw DcborParseError.unknownKnownValueName(
        token.value,
        span(tokenSpan.start + 1, tokenSpan.end - 1),
      );
    }
    case "Unit":
      return new KnownValue(0).toCbor();
    case "BracketOpen":
      return parseArray(lexer, options);
    case "BraceOpen":
      return parseMap(lexer, options);
    case "BraceClose":
    case "BracketClose":
    case "ParenthesisOpen":
    case "ParenthesisClose":
    case "Colon":
    case "Comma":
      throw DcborParseError.unexpectedToken(token, lexer.span());
  }
}

function parseString(s: string, tokenSpan: Span): Cbor {
  if (s.startsWith('"') && s.endsWith('"')) {
    return cbor(s.slice(1, -1));
  }
  throw DcborParseError.unrecognizedToken(tokenSpan);
}

function tagForName(name: string, options: ParseOptions): number | bigint | undefined {
  return (options.tags ?? getGlobalTagsStore()).tagForName(name)?.value;
}

function knownValueForName(name: string, options: ParseOptions): KnownValue | undefined {
  return (options.knownValues ?? getGlobalKnownValuesStore()).byName(name);
}

function parseUr(ur: UR, tokenSpan: Span, options: ParseOptions): Cbor {
  const urType = ur.type.name;
  const tag = tagForName(urType, options);
  if (tag !== undefined) {
    return taggedValue(tag, ur.cbor);
  }
  throw DcborParseError.unknownUrType(
    urType,
    span(tokenSpan.start + 3, tokenSpan.start + 3 + urType.length),
  );
}

function parseNumberTag(tagValue: number | bigint, lexer: Lexer, options: ParseOptions): Cbor {
  const item = parseItem(lexer, options);
  const close = expectCloseParenthesis(lexer);
  if (close.type === "ParenthesisClose") {
    return taggedValue(tagValue, item);
  }
  throw DcborParseError.unmatchedParentheses(lexer.span());
}

function expectCloseParenthesis(lexer: Lexer): Token {
  try {
    return expectToken(lexer);
  } catch (e) {
    if (DcborParseError.isDcborParseError(e) && e.code === "UnexpectedEndOfInput") {
      throw DcborParseError.unmatchedParentheses(lexer.span());
    }
    throw e;
  }
}

function parseNameTag(name: string, lexer: Lexer, options: ParseOptions): Cbor {
  const tagSpan = span(lexer.span().start, lexer.span().end - 1);
  const item = parseItem(lexer, options);
  const close = expectToken(lexer);
  if (close.type === "ParenthesisClose") {
    const tag = tagForName(name, options);
    if (tag !== undefined) {
      return taggedValue(tag, item);
    }
    throw DcborParseError.unknownTagName(name, tagSpan);
  }
  throw DcborParseError.unmatchedParentheses(lexer.span());
}

function parseArray(lexer: Lexer, options: ParseOptions): Cbor {
  const items: Cbor[] = [];
  let awaitsComma = false;
  let awaitsItem = false;
  for (;;) {
    const token = expectToken(lexer);
    if (token.type === "BracketClose" && !awaitsItem) {
      return cbor(items);
    }
    if (token.type === "Comma" && awaitsComma) {
      awaitsItem = true;
      awaitsComma = false;
      continue;
    }
    if (awaitsComma) {
      throw DcborParseError.expectedComma(lexer.span());
    }
    items.push(parseItemToken(token, lexer, options));
    awaitsItem = false;
    awaitsComma = true;
  }
}

function parseMap(lexer: Lexer, options: ParseOptions): Cbor {
  const map = new CborMap();
  let awaitsComma = false;
  let awaitsKey = false;
  for (;;) {
    let token: Token;
    try {
      token = expectToken(lexer);
    } catch (e) {
      if (DcborParseError.isDcborParseError(e) && e.code === "UnexpectedEndOfInput") {
        throw DcborParseError.unmatchedBraces(lexer.span());
      }
      throw e;
    }
    if (token.type === "BraceClose" && !awaitsKey) {
      return cbor(map);
    }
    if (token.type === "Comma" && awaitsComma) {
      awaitsKey = true;
      awaitsComma = false;
      continue;
    }
    if (awaitsComma) {
      throw DcborParseError.expectedComma(lexer.span());
    }
    const key = parseItemToken(token, lexer, options);
    const keySpan = lexer.span();
    if (map.has(key)) {
      throw DcborParseError.duplicateMapKey(keySpan);
    }
    let colon: Token | undefined;
    try {
      colon = expectToken(lexer);
    } catch {
      colon = undefined;
    }
    if (colon?.type !== "Colon") {
      throw DcborParseError.expectedColon(lexer.span());
    }
    let value: Cbor;
    try {
      value = parseItem(lexer, options);
    } catch (e) {
      if (
        DcborParseError.isDcborParseError(e) &&
        e.code === "UnexpectedToken" &&
        e.details.token?.type === "BraceClose" &&
        e.details.span !== undefined
      ) {
        throw DcborParseError.expectedMapKey(e.details.span);
      }
      throw e;
    }
    map.set(key, value);
    awaitsKey = false;
    awaitsComma = true;
  }
}

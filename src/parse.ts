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
import { KnownValue, getGlobalKnownValuesStore } from "@blockchaincommons/known-values";
import { type Span, span, DcborParseError, type DcborResult } from "./error";
import { type Token, Lexer } from "./token";

/** Where known-value names resolve; a `KnownValuesStore` satisfies it. */
export interface KnownValueResolver {
  /** The known value registered under `name`, or `undefined`. */
  byName(name: string): KnownValue | undefined;
}

/** How names resolve and how deep an item may nest; every field has a default. */
export interface ParseOptions {
  /** Where tag names and UR types resolve; the global tags store by default. */
  readonly tags?: ReadonlyTagsStore | undefined;
  /** Where known-value names resolve; the global known-values store by default. */
  readonly knownValues?: KnownValueResolver | undefined;
  /** The deepest nesting of arrays, maps and tags accepted (a positive integer), 1 000 by default. */
  readonly maxDepth?: number | undefined;
}

/** A parsed prefix: the item and how many UTF-16 code units of the source it took. */
export interface ParsedPrefix {
  /** The first item of the source. */
  readonly value: Cbor;
  /** The number of UTF-16 code units consumed, trailing whitespace and comments included. */
  readonly length: number;
}

const DEFAULT_MAX_DEPTH = 1000;

/** The resolved options plus the current nesting depth. */
interface Context {
  readonly tags: ReadonlyTagsStore;
  readonly knownValues: KnownValueResolver;
  readonly maxDepth: number;
  depth: number;
}

function requireSource(fn: string, src: unknown): asserts src is string {
  if (typeof src !== "string") {
    throw new TypeError(`${fn}: src must be a string`);
  }
}

/** @internal Validates `options` and fills in the defaults; a wrong type is a `TypeError`. */
export function resolveOptions(fn: string, options: ParseOptions | undefined): Context {
  if (options === undefined) {
    return {
      tags: getGlobalTagsStore(),
      knownValues: getGlobalKnownValuesStore(),
      maxDepth: DEFAULT_MAX_DEPTH,
      depth: 0,
    };
  }
  if (typeof options !== "object" || options === null) {
    throw new TypeError(`${fn}: options must be an object`);
  }
  const { tags, knownValues, maxDepth } = options as {
    tags?: unknown;
    knownValues?: unknown;
    maxDepth?: unknown;
  };
  if (tags !== undefined && !hasMethod(tags, "tagForName")) {
    throw new TypeError(`${fn}: options.tags must be a tags store (an object with tagForName)`);
  }
  if (knownValues !== undefined && !hasMethod(knownValues, "byName")) {
    throw new TypeError(
      `${fn}: options.knownValues must be a known-value resolver (an object with byName)`,
    );
  }
  if (
    maxDepth !== undefined &&
    (typeof maxDepth !== "number" || !Number.isInteger(maxDepth) || maxDepth < 1)
  ) {
    throw new TypeError(`${fn}: options.maxDepth must be a positive integer`);
  }
  return {
    tags: (tags as ReadonlyTagsStore | undefined) ?? getGlobalTagsStore(),
    knownValues: (knownValues as KnownValueResolver | undefined) ?? getGlobalKnownValuesStore(),
    maxDepth: maxDepth ?? DEFAULT_MAX_DEPTH,
    depth: 0,
  };
}

function hasMethod(value: unknown, name: string): boolean {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as Record<string, unknown>)[name] === "function"
  );
}

/**
 * Parses one dCBOR item from `src`, which must contain nothing else but
 * whitespace and comments.
 *
 * @throws {DcborParseError} for text that does not parse
 * @throws {TypeError} for a `src` that is not a string or an option of the wrong type
 */
export function parseDcbor(src: string, options?: ParseOptions): Cbor {
  requireSource("parseDcbor", src);
  return parseWith(src, resolveOptions("parseDcbor", options));
}

/** @internal Parses `src` as a whole item in an already resolved context. */
export function parseWith(src: string, ctx: Context): Cbor {
  ctx.depth = 0;
  const lexer = new Lexer(src);
  const first = expectFirstToken(lexer);
  const value = parseItemToken(first, lexer, ctx);
  if (hasMore(lexer)) {
    throw DcborParseError.extraData(lexer.span);
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

/**
 * `parseDcbor` as a `Result` instead of a throw. Every string is an outcome;
 * a `src` that is not a string or an option of the wrong type still throws
 * `TypeError`.
 */
export function tryParseDcbor(
  src: string,
  options?: ParseOptions,
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
 * @throws {DcborParseError} for text that does not parse
 * @throws {TypeError} for a `src` that is not a string or an option of the wrong type
 */
export function parseDcborPrefix(src: string, options?: ParseOptions): ParsedPrefix {
  requireSource("parseDcborPrefix", src);
  const ctx = resolveOptions("parseDcborPrefix", options);
  const lexer = new Lexer(src);
  const first = expectFirstToken(lexer);
  const value = parseItemToken(first, lexer, ctx);
  const length = hasMore(lexer) ? lexer.span.start : src.length;
  return Object.freeze({ value, length });
}

/** `parseDcborPrefix` as a `Result` instead of a throw; the `TypeError` contract of `tryParseDcbor` applies. */
export function tryParseDcborPrefix(
  src: string,
  options?: ParseOptions,
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

function parseItem(lexer: Lexer, ctx: Context): Cbor {
  return parseItemToken(expectToken(lexer), lexer, ctx);
}

/** The next token; end of input and unrecognised text are errors. */
function expectToken(lexer: Lexer): Token {
  const spanBefore = lexer.span;
  let token: Token | undefined;
  try {
    token = lexer.next();
  } catch (e) {
    // Unrecognised text is reported at the previous token's span.
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

/** Enters one nesting level at `opening`, or throws `NestingTooDeep`. */
function enter(ctx: Context, opening: Span): void {
  if (ctx.depth >= ctx.maxDepth) {
    throw DcborParseError.nestingTooDeep(ctx.maxDepth, opening);
  }
  ctx.depth++;
}

function parseItemToken(token: Token, lexer: Lexer, ctx: Context): Cbor {
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
      return cbor(token.value);
    case "UR": {
      const urType = token.value.type.name;
      const tag = ctx.tags.tagForName(urType)?.value;
      if (tag !== undefined) {
        return taggedValue(tag, token.value.cbor);
      }
      throw DcborParseError.unknownUrType(
        urType,
        span(token.span.start + 3, token.span.start + 3 + urType.length),
      );
    }
    case "TagValue":
      return parseNumberTag(token, lexer, ctx);
    case "TagName":
      return parseNameTag(token, lexer, ctx);
    case "KnownValueNumber":
      return new KnownValue(token.value).toCbor();
    case "KnownValueName": {
      const knownValue = ctx.knownValues.byName(token.value);
      if (knownValue !== undefined) {
        return knownValue.toCbor();
      }
      if (token.value === "") {
        // The empty name is the unit value even when the resolver does not index it.
        return new KnownValue(0).toCbor();
      }
      throw DcborParseError.unknownKnownValueName(
        token.value,
        span(token.span.start + 1, token.span.end - 1),
      );
    }
    case "Unit":
      return new KnownValue(0).toCbor();
    case "BracketOpen":
      return parseArray(token, lexer, ctx);
    case "BraceOpen":
      return parseMap(token, lexer, ctx);
    case "BraceClose":
    case "BracketClose":
    case "ParenthesisOpen":
    case "ParenthesisClose":
    case "Colon":
    case "Comma":
      throw DcborParseError.unexpectedToken(token.type, lexer.slice, token.span);
  }
}

function parseNumberTag(token: Token & { type: "TagValue" }, lexer: Lexer, ctx: Context): Cbor {
  enter(ctx, token.span);
  const item = parseItem(lexer, ctx);
  const close = expectCloseParenthesis(lexer);
  ctx.depth--;
  if (close.type === "ParenthesisClose") {
    return taggedValue(token.value, item);
  }
  throw DcborParseError.unmatchedParentheses(close.span);
}

function expectCloseParenthesis(lexer: Lexer): Token {
  try {
    return expectToken(lexer);
  } catch (e) {
    if (DcborParseError.isDcborParseError(e) && e.code === "UnexpectedEndOfInput") {
      throw DcborParseError.unmatchedParentheses(lexer.span);
    }
    throw e;
  }
}

function parseNameTag(token: Token & { type: "TagName" }, lexer: Lexer, ctx: Context): Cbor {
  const tagSpan = span(token.span.start, token.span.end - 1);
  enter(ctx, token.span);
  const item = parseItem(lexer, ctx);
  const close = expectToken(lexer);
  ctx.depth--;
  if (close.type === "ParenthesisClose") {
    const tag = ctx.tags.tagForName(token.value)?.value;
    if (tag !== undefined) {
      return taggedValue(tag, item);
    }
    throw DcborParseError.unknownTagName(token.value, tagSpan);
  }
  throw DcborParseError.unmatchedParentheses(close.span);
}

function parseArray(opening: Token, lexer: Lexer, ctx: Context): Cbor {
  enter(ctx, opening.span);
  const items: Cbor[] = [];
  let awaitsComma = false;
  let awaitsItem = false;
  for (;;) {
    const token = expectToken(lexer);
    if (token.type === "BracketClose" && !awaitsItem) {
      ctx.depth--;
      return cbor(items);
    }
    if (token.type === "Comma" && awaitsComma) {
      awaitsItem = true;
      awaitsComma = false;
      continue;
    }
    if (awaitsComma) {
      throw DcborParseError.expectedComma(token.span);
    }
    items.push(parseItemToken(token, lexer, ctx));
    awaitsItem = false;
    awaitsComma = true;
  }
}

function parseMap(opening: Token, lexer: Lexer, ctx: Context): Cbor {
  enter(ctx, opening.span);
  const map = new CborMap();
  let awaitsComma = false;
  let awaitsKey = false;
  for (;;) {
    let token: Token;
    try {
      token = expectToken(lexer);
    } catch (e) {
      if (DcborParseError.isDcborParseError(e) && e.code === "UnexpectedEndOfInput") {
        throw DcborParseError.unmatchedBraces(lexer.span);
      }
      throw e;
    }
    if (token.type === "BraceClose" && !awaitsKey) {
      ctx.depth--;
      return cbor(map);
    }
    if (token.type === "Comma" && awaitsComma) {
      awaitsKey = true;
      awaitsComma = false;
      continue;
    }
    if (awaitsComma) {
      throw DcborParseError.expectedComma(token.span);
    }
    const key = parseItemToken(token, lexer, ctx);
    const keySpan = lexer.span;
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
      throw DcborParseError.expectedColon(lexer.span);
    }
    let value: Cbor;
    try {
      value = parseItem(lexer, ctx);
    } catch (e) {
      if (
        DcborParseError.isDcborParseError(e) &&
        e.code === "UnexpectedToken" &&
        e.details.kind === "BraceClose"
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

# Migrating from `@bcts/dcbor-parse` to `@blockchaincommons/dcbor-parse`

`@blockchaincommons/dcbor-parse` is the successor to `@bcts/dcbor-parse`.

## Parsing

| Before | After |
|---|---|
| `parseDcborItem(src): ParseResult<Cbor>` | `parseDcborItem(src, options?): Cbor` (throws) or `tryParseDcborItem(src, options?)` |
| `parseDcborItemPartial(src): ParseResult<[Cbor, number]>` | `parseDcborItemPartial(src, options?): { value, length }` (throws) or `tryParseDcborItemPartial` |
| `composeDcborArray(items): ComposeResult<Cbor>` | `composeDcborArray(items, options?): Cbor` (throws) or `tryComposeDcborArray` |
| `composeDcborMap(items)` | `composeDcborMap(items, options?)` / `tryComposeDcborMap` |

`options` is `{ tags?, knownValues?, maxDepth? }`: `tags` is a
`ReadonlyTagsStore`, `knownValues` anything with `byName(name)` (a
`KnownValuesStore` qualifies), `maxDepth` a positive integer (1 000).
Omitted fields use the global stores and the default depth.

The `try…` forms return the same `{ ok: true, value } | { ok: false, error }`
shape the old functions did, so most call sites need only the rename and the
error field changes below:

```diff
- const r = parseDcborItem(text);
- if (!r.ok) console.error(fullErrorMessage(r.error, text));
+ const r = tryParseDcborItem(text);
+ if (!r.ok) console.error(r.error.fullMessage(text));
```

## Errors

`ParseError` (a union of `{ type, … }` objects) is the `DcborParseError`
class; `ComposeError` is `DcborComposeError`.

| Before | After |
|---|---|
| `error.type` | `error.code` (the same PascalCase names, as `DcborParseErrorCode`) |
| `error.span`, `error.name`, `error.value`, `error.urType`, `error.dateString` | `error.details.span` (also `error.span`), `error.details.name`, `.value`, `.urType`, `.dateString` — typed by `error.code` |
| `error.token` (the decoded `Token`) | `error.details.token` (the same `Token`; `Token` is exported from the root as a type) |
| `error.message` on an `InvalidUr` | `error.details.cause` |
| `errorMessage(error)` | `error.message` |
| `fullErrorMessage(error, source)` | `error.fullMessage(source)` |
| `errorSpan(error)` | `error.span` |
| `composeError.type === "ParseError"` and `composeError.error` | `composeError.code === "ParseError"` and `composeError.cause` |
| `composeErrorMessage(e)` | `e.message` |
| `ok`, `err`, `isOk`, `isErr`, `unwrap`, `unwrapErr`, `isDefaultError`, `defaultParseError`, `defaultSpan`, `parseError.*`, `composeError.*` | gone |
| `new DcborParseError(code, message, details)` | gone; the static factories build every instance |

`error.details` is frozen and discriminated by `code`; `error.is(code)` is a
shorthand. `isDcborParseError` recognises an error from any copy of the
package (ESM and CommonJS builds included).

A `src` that is not a string, `options` that is not an object (or whose
`tags`, `knownValues` or `maxDepth` has the wrong type), and compose `items`
that are not an array of strings throw a `TypeError` from every form,
including `tryParseDcborItem`; before, these surfaced as engine errors from
inside the parser or were silently accepted.

Spans stay UTF-16 code-unit offsets; `spanToByteOffsets(source, span)` gives
the byte offsets the Rust reference reports.

## Lexer

`Lexer` and `Token` live on `@blockchaincommons/dcbor-parse/lexer` (beta).
`Lexer` is iterable; `next()` returns `Token | undefined` and throws
`DcborParseError` instead of returning a result object. Every token carries
its `span`; `lexer.span` and `lexer.slice` are getters for the last token. The
`token` constructor namespace is gone: tokens are plain readonly literals.

## Behaviour changes

Towards the reference:

- A date literal keeps its exact fractional seconds
  (`2023-12-25T10:30:45.123456Z` no longer rounds to milliseconds).
- `…T10:30:60Z` (a leap second) is accepted as the following minute.
- Years 0000–0099 are accepted and encode as themselves.
- `truex`, `nullx`, `NaNx` etc. are one unrecognised token; before, the
  keyword lexed and the rest was reported as extra data (so
  `parseDcborItemPartial("truex")` succeeded).
- `true(1)` and the other keywords followed by `(` are tag names, so they
  are `UnknownTagName`; before, the keyword lexed and `(1)` was extra data.
- A base64 literal with non-zero trailing bits (`b64'QR=='`) is
  `InvalidBase64String`; before it decoded.
- `'value'` and `'Self'` no longer resolve: the bundled registry follows the
  reference's store.
- `Unit` inside an array (`[Unit]`) is `UnexpectedToken`; it stays the unit
  value everywhere else.
- A literal that matches its pattern but does not decode inside an array
  (`[h'abc']`, `[b64'QR==']`, `[2023-13-45]`) is `UnexpectedToken` carrying
  the token (`error.details.token.value.error` is the literal's error),
  `ExpectedComma` where a comma was awaited (`[1 h'abc']`) and
  `UnmatchedParentheses` where a tag's `)` was (`1(1 h'abc')`); before, the
  literal's own error was reported at every site. An unknown known-value name
  inside an array spans its quotes (`['zzz']` → 1..6).
- A hex or base64 literal that does not match its pattern (`h'zz'`, `h'`,
  `b64'A'`, `b64''`, `b64'QQ =='`) is `UnrecognizedToken` at the previous
  token; before it was `InvalidHexString` or `InvalidBase64String` over the
  literal. A literal that matches and then fails to decode (`h'abc'`,
  `b64'QR=='`) keeps its own error.
- Error spans: at the end of the source the span is empty and sits at the end
  (`42(1` → `UnmatchedParentheses` at 4..4, before 3..4); unrecognised text
  that starts like an identifier spans the whole identifier (`1_000` →
  `ExtraData` at 1..5, before 1..2); a whitespace run that ends in an
  unterminated `/…` comment is one unrecognised run from where the whitespace
  began (`1 /x` → `ExtraData` at 1..4, before 2..3), and
  `parseDcborItemPartial("1 /x").length` is 1, before 2.
- A date literal with non-ASCII digits (`٢٠٢٣-01-01`) is `InvalidDateString`;
  before it was `UnrecognizedToken`.

This package's own:

- Nesting deeper than `maxDepth` (1 000) is `NestingTooDeep`; before, a few
  thousand levels overflowed the call stack with a `RangeError`.

## Dependencies

`@blockchaincommons/dcbor-compat` is replaced by `@blockchaincommons/dcbor`;
the values returned are canonical `Cbor` (`value.toData()`,
`diagnostic(value)` from `@blockchaincommons/dcbor/diagnostic`).

## Appendix: migrating from `@bcts/dcbor-parse`

`@blockchaincommons/dcbor-parse` is the canonical home of this library. It was extracted from the
[`paritytech/bcts`](https://github.com/paritytech/bcts) monorepo, where it was
published as `@bcts/dcbor-parse`, into its own Blockchain Commons repository at
[`BlockchainCommons/bc-dcbor-parse-ts`](https://github.com/BlockchainCommons/bc-dcbor-parse-ts).

`1.0.0-beta.1` is the first release under the new scope; the sections above
list every renamed and removed name.

### TL;DR checklist

- [ ] Replace the `@bcts/dcbor-parse` dependency with `@blockchaincommons/dcbor-parse`.
- [ ] Rewrite import specifiers: `@bcts/dcbor-parse` becomes `@blockchaincommons/dcbor-parse`.
- [ ] Raise your Node floor to **22.12**.
- [ ] Ensure TypeScript **>= 5.7** to consume the published types.
- [ ] If you relied on the `browser` field or a global-script build, switch to the ESM or CJS entry point.

### 1. Package name and imports

```diff
- import { /* ... */ } from "@bcts/dcbor-parse";
+ import { /* ... */ } from "@blockchaincommons/dcbor-parse";
```

```diff
  "dependencies": {
-   "@bcts/dcbor-parse": "^1.0.0-beta.6"
+   "@blockchaincommons/dcbor-parse": "^1.0.0-beta.1"
  }
```

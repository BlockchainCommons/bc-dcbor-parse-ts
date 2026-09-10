# Migrating to the redesigned `@blockchaincommons/dcbor-parse`

The language is unchanged: every string that parsed before parses to the
same bytes, and every rejection keeps its variant and span (proven by
`tests/differential.test.ts` against the frozen pre-redesign bundle, with
three exceptions listed at the end, all fixes towards the Rust reference).
What changed is how results and errors are delivered.

## Parsing

| Before | After |
|---|---|
| `parseDcborItem(src): ParseResult<Cbor>` | `parseDcbor(src, options?): Cbor` (throws) or `tryParseDcbor(src, options?)` |
| `parseDcborItemPartial(src): ParseResult<[Cbor, number]>` | `parseDcborPrefix(src, options?): { value, length }` (throws) or `tryParseDcborPrefix` |
| `composeDcborArray(items): ComposeResult<Cbor>` | `composeDcborArray(items, options?): Cbor` (throws) or `tryComposeDcborArray` |
| `composeDcborMap(items)` | `composeDcborMap(items, options?)` / `tryComposeDcborMap` |

`options` is `{ tags?: ReadonlyTagsStore; knownValues?: KnownValuesStore }`;
omitted fields use the global stores, as before.

The `try…` forms return the same `{ ok: true, value } | { ok: false, error }`
shape the old functions did, so most call sites need only the rename and the
error field changes below:

```diff
- const r = parseDcborItem(text);
- if (!r.ok) console.error(fullErrorMessage(r.error, text));
+ const r = tryParseDcbor(text);
+ if (!r.ok) console.error(r.error.fullMessage(text));
```

## Errors

`ParseError` (a union of `{ type, … }` objects) is the `DcborParseError`
class; `ComposeError` is `DcborComposeError`.

| Before | After |
|---|---|
| `error.type` | `error.code` (the same PascalCase names, as `DcborParseErrorCode`) |
| `error.span`, `error.token`, `error.name`, `error.value`, `error.urType`, `error.message`, `error.dateString` | `error.details.span` (also `error.span`), `error.details.token`, … |
| `errorMessage(error)` | `error.message` |
| `fullErrorMessage(error, source)` | `error.fullMessage(source)` |
| `errorSpan(error)` | `error.span` |
| `composeError.type === "ParseError"` and `composeError.error` | `composeError.code === "ParseError"` and `composeError.cause` |
| `composeErrorMessage(e)` | `e.message` |
| `ok`, `err`, `isOk`, `isErr`, `unwrap`, `unwrapErr`, `isDefaultError`, `defaultParseError`, `defaultSpan`, `parseError.*`, `composeError.*` | gone |

Spans stay UTF-16 code-unit offsets; `spanToByteOffsets(source, span)` gives
the byte offsets the Rust reference reports.

## Lexer

`Lexer`, `Token` and `token` live on `@blockchaincommons/dcbor-parse/lexer`.
`Lexer.next()` returns `Token | undefined` and throws `DcborParseError`
instead of returning a result object.

## Behaviour changes (towards the reference)

- A date literal keeps its exact fractional seconds
  (`2023-12-25T10:30:45.123456Z` no longer rounds to milliseconds).
- `…T10:30:60Z` (a leap second) is accepted as the following minute.
- `truex`, `nullx`, `NaNx` etc. are one unrecognised token; before, the
  keyword lexed and the rest was reported as extra data (so
  `parseDcborItemPartial("truex")` succeeded).

## Dependencies

`@blockchaincommons/dcbor-compat` is replaced by `@blockchaincommons/dcbor`;
the values returned are canonical `Cbor` (`value.toData()`,
`diagnostic(value)` from `@blockchaincommons/dcbor/diagnostic`).

## Appendix: migrating from `@bcts/dcbor-parse`

`@blockchaincommons/dcbor-parse` is the canonical home of this library. It was extracted from the
[`paritytech/bcts`](https://github.com/paritytech/bcts) monorepo, where it was
published as `@bcts/dcbor-parse`, into its own Blockchain Commons repository at
[`BlockchainCommons/bc-dcbor-parse-ts`](https://github.com/BlockchainCommons/bc-dcbor-parse-ts).

For the extraction release, **`1.0.0-beta.1`, the public API is unchanged.** The
migration is a rename. `@bcts/dcbor-parse` remains published for one beta cycle as a
thin re-export of this package, so nothing breaks the moment you update.

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

### 2. Version numbering restarts

`@bcts/dcbor-parse` versions moved in lockstep with every other package in the
monorepo, which is why it reached `1.0.0-beta.6`. Each extracted package now
versions independently and starts again at `1.0.0-beta.1`. A lower version
number here does **not** mean older code.

### 3. Node and TypeScript floors moved up

| | `@bcts/dcbor-parse` | `@blockchaincommons/dcbor-parse` |
|---|---|---|
| Node | `>= 18` | `>= 22.12` |
| TypeScript (consumers) | 6.x | `>= 5.7` |

### 4. The IIFE / global-script build is gone

`@bcts/dcbor-parse` shipped an additional IIFE bundle exposed through the `browser`
field. That build is dropped: IIFE entry points cannot share chunks, which forks
module-level singletons across entry points. Use the ESM entry (`import`) or the
CJS entry (`require`); both are declared in `exports` and validated in CI by
`publint` and `@arethetypeswrong/cli`.

### 5. Peer packages renamed too

Every sibling library moved from the `@bcts` scope to `@blockchaincommons`. If
you depend on more than one, rename them together so a single copy of each
shared type is resolved:

| Old | New |
|---|---|
| `@bcts/dcbor` | `@blockchaincommons/dcbor` |
| `@bcts/<name>` | `@blockchaincommons/<name>` |

### 6. What did not change

- The public API: every exported name, signature and type is identical.
- The wire format. Encodings produced by `@bcts/dcbor-parse` decode here, and the reverse.
- Parity with the Rust reference implementation. See [`RUST_DIVERGENCES.md`](./RUST_DIVERGENCES.md).

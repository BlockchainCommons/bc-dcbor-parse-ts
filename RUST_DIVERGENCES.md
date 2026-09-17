# Divergences from the Rust reference implementation

This library is a TypeScript port of
[`BlockchainCommons/bc-dcbor-parse-rust`](https://github.com/BlockchainCommons/bc-dcbor-parse-rust),
tracked at version **0.11.1**
([`3c91f62`](https://github.com/BlockchainCommons/bc-dcbor-parse-rust/commit/3c91f62edf5b2892e6f32eac68c055d9d4b22df8)).

The tracked version and commit are recorded in
[`.github/versions.yml`](./.github/versions.yml), and the `upstream.yml`
workflow opens a tracking issue whenever the reference implementation moves
ahead of it.

This document is the deliberate record of every place the TypeScript behaviour
differs from the Rust reference. It has five kinds of entry:

1. **True behavioral divergences** - the same input produces a different outcome.
2. **JS-only input domain** - inputs that have no Rust analog, so there is nothing to diverge from.
3. **Mapping equivalences** - rules of the reference reproduced through a different mechanism, validated through the bytes and errors they produce.
4. **Reference behaviours reproduced on purpose** - reference quirks this library replicates rather than corrects, so that the two implementations agree; each is recorded below with its upstream status, and followed if the reference changes.
5. **The dcbor dependency** - what this package delegates to `@blockchaincommons/dcbor`.

Every comparable entry below is checked by `tests/rust-validation`, a Rust
program that replays `tests/vectors/vectors.json` (1 301 vectors: the
hand-written strings of both implementations' suites, grammar-generated
sources up to depth 4 with corruptions, and focused categories for base64,
dates, keywords, known-value names, prefix parses, Unicode, the error sites
and span rules, nesting depth and the JavaScript-only argument domain)
against the `dcbor-parse` release from crates.io, comparing the dCBOR hex or
the error variant and span (Rust byte offsets transcoded to UTF-16 code
units). The current run: **1 255 match, 12 S1, 5 N1, 5 U1, 24 JS-only, 0
mismatches.** A mismatch is a bug on one side. A JavaScript-only input
becomes a harness rule, not an entry here.

## 1. True behavioral divergences

### Nesting deeper than `maxDepth` (N1, 5 vectors)

`ParseOptions.maxDepth` (1 000 by default) bounds the nesting of arrays,
maps and tags; deeper input is `NestingTooDeep`. The reference has no limit:
it parses ten thousand levels on its main thread and aborts the process at
twenty thousand. A document between 1 001 and roughly 10 000 levels is
therefore accepted there and rejected here. The limit is deliberate: a
JavaScript stack overflow is a `RangeError` at a depth that depends on the
engine and on the caller's own stack (Node 24 overflows this parser near
3 000 levels, Bun near 50 000), and a typed rejection at a documented depth
is only possible with a limit below every engine's floor.

### Error spans inside a failed quoted literal or `ur:` prefix (S1, 12 vectors)

Both sides reject the same strings with the same variant. Where the
reference's lexer fails inside a quoted literal, a `ur:` prefix or an `h'`
prefix after an item (`1 'a `, `1 "a\q"`, `1 ur:a/abc`, `1 h'zz'`), its
`ExtraData` span ends where its generated automaton stopped reading, which
depends on how that generator groups bytes (`ur:a/abc` ends after `ur:a`,
`"a\"` after the escaped quote); this library spans what it scanned: one
code point, or the identifier run (`ur`, `h`). Every other span rule of the
reference is reproduced: `UnrecognizedToken` carries the previous token's
span, an error at the end of the source has an empty span there, an
unrecognised run that starts with an identifier character covers the
identifier, and a whitespace run that ends in an unterminated `/…` comment is
one unrecognised run from where the whitespace began. Spans are UTF-16
code-unit offsets here (the language's native unit); the harness transcodes
the reference's byte offsets.

## 2. JS-only input domain

- **Arguments of the wrong type (24 vectors).** A `src` that is not a
  string, `options` that is not an object or whose `tags`/`knownValues`/
  `maxDepth` has the wrong type, and compose `items` that are not an array
  of strings throw a `TypeError` from every form. The reference's types
  cannot express these.
- **The empty known-value name with a caller-supplied resolver.** `''`
  resolves through `options.knownValues` and falls back to codepoint 0 when
  the resolver has no `""`; the global store, like the reference's, indexes
  `""`.

## 3. Mapping equivalences

- Numbers are lexed as float64 on both sides (`parse::<f64>` /
  `parseFloat`), so integers beyond 2^53 round identically. Tag numbers and
  known-value numbers keep the full unsigned 64-bit range, as a `number` up
  to `Number.MAX_SAFE_INTEGER` and a `bigint` above it.
- String escapes are validated by the same grammar and kept verbatim on both
  sides: `"\n"` encodes the backslash and the `n`, so `parse(diagnostic(v))`
  is not the identity for strings containing `"` or `\`. The reference's own
  tests assert it; if the reference changes, both sides change together.
- Base64 is decoded strictly on both sides (canonical padding, zero
  trailing bits). A hex or base64 literal that does not match the
  reference's whole-literal pattern (`h'zz'`, `h'`, `b64''`, `b64'A'`) is
  not a token on either side and is `UnrecognizedToken` at the previous
  token; only a literal that matches and then fails decoding (`h'abc'`,
  `b64'QR=='`) is `InvalidHexString` or `InvalidBase64String`.
- The six literal kinds (`h'…'`, `b64'…'`, dates, `n(`, `'n'`, `ur:…`)
  are tokens that carry their decoded value or their own error, on both
  sides (`Result` payloads there, `DcborResult` here). A literal that did not
  decode, or `Unit`, as an array element is `UnexpectedToken` carrying the
  token, `ExpectedComma` where a comma is awaited and `UnmatchedParentheses`
  where a tag's `)` is awaited; as a map key, a map value, tag content or at
  the top level the literal's own error is reported, and `Unit` is the unit
  value. `date(1` is `UnexpectedEndOfInput` where `1(1` is
  `UnmatchedParentheses`; `[1` is `UnexpectedEndOfInput` where `{1: 2` is
  `UnmatchedBraces`. These are the reference's rules, reproduced (see §4).
- A keyword directly followed by `(` is a tag name on both sides (`true(1)`
  is `UnknownTagName`), the reference's longest-match rule. A keyword that
  runs into identifier characters (`truex`) is one unrecognised run.
- Date literals admit any decimal digit on both sides (`\d` is Unicode in
  the reference's lexer, `\p{Nd}` here), so `٢٠٢٣-01-01` is
  `InvalidDateString`; numbers are ASCII on both sides.
- Tag names resolve through dcbor's tags store on both sides
  (`bc_tags::register_tags()` / `registerTags(getGlobalTagsStore())`);
  known-value names through the known-values registry, which names the
  same codepoints as the reference's. Explicit `tags` and `knownValues`
  options exist because a CommonJS and an ESM build of a package are two
  module graphs with two globals.
- `UnexpectedToken` carries the token on both sides. `parseDcborItemPartial`
  returns `{ value, length }` for the reference's `(CBOR, usize)`, with
  `length` in UTF-16 code units. `parseDcborItem` and the compose functions
  throw `DcborParseError` / `DcborComposeError` (with a `code` and typed
  `details`) where the reference returns `Result`; the `try…` forms return
  a result instead.

## 4. Reference behaviours reproduced on purpose

| # | Behaviour | Upstream |
|---|---|---|
| U1 | The reference panics on `2023-01-01T`, `2023-12-25T10:30:45.`, `2023-12-25T10:30:45+0100`, `2023-12-25T10:30:45+01` and `1١` (its number callback unwraps a failed `f64` parse); this library rejects them (`ExtraData`, `InvalidDateString`). A panic has no error variant to reproduce. The harness catches the panic and counts the row as U1 (5 vectors). | not yet filed |
| U2 | `Unit` and a literal that did not decode are `UnexpectedToken` inside an array (its array parser has no arm for them), while `Unit` is accepted and the literal's error is named everywhere else. Reproduced (§3). | not yet filed |
| U3 | `parse_dcbor_item_partial("1 /x")` returns 1, the start of the whitespace run before the unterminated comment, against its own documentation ("after skipping any trailing whitespace or comments"). Reproduced: `parseDcborItemPartial("1 /x").length` is 1. | not yet filed |
| U4 | `UnknownKnownValueName` spans the quotes inside an array (`['zzz']` → 1..6) and the name elsewhere (`'zzz'` → 1..4). Reproduced. | not yet filed |

## 5. The dcbor dependency

Date literals go through `CborDate.fromString` from
`@blockchaincommons/dcbor` (`^1.0.0-beta.3`), whose grammar and validation
equal the reference's `Date::from_string`: nanosecond fractions, offsets
below 24 hours, the `:60` leap second, years from 0000, ASCII digits only.
Hex literals decode through dcbor's `hexToBytes`.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit, and the
   `dcbor-parse` pin in `tests/rust-validation/Cargo.toml`.
4. Update the tracked version at the top of this file.
5. Add, amend, or remove divergence entries as the port requires, and keep
   the harness classes in `tests/rust-validation/src/main.rs` in step. A
   `MISMATCH` from the harness is a bug on one side, never a new class. When
   an item of §4 is fixed upstream, the port follows and the row goes.

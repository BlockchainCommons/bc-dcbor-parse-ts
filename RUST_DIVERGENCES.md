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
3. **Mapping equivalences** - JS-specific inputs that are validated through the bytes they produce.
4. **Upstream defects** - reference behaviour the port does not replicate, filed upstream.
5. **The dcbor dependency** - what this package delegates to `@blockchaincommons/dcbor`.

Every entry below is checked by `tests/rust-validation`, a Rust program that
replays `tests/vectors/vectors.json` (1 141 vectors: the hand-written
strings of both implementations' suites, grammar-generated sources up to
depth 4 with corruptions, and focused categories for base64, dates,
keywords, known-value names, prefix parses, Unicode, nesting depth and the
JavaScript-only argument domain) against the `dcbor-parse` release from
crates.io, comparing the dCBOR hex or the error variant and span (Rust byte
offsets transcoded to UTF-16 code units). The current run:
**1 048 match, 13 S1, 37 S2, 4 S3, 2 S4, 3 D2, 5 N1, 5 U1, 24 JS-only, 0
mismatches.**

## 1. True behavioral divergences

### D2. `Unit` inside containers (3 vectors)

The reference accepts the `Unit` keyword at top level but rejects it inside
an array or map (`UnexpectedToken(Unit)`); its `''` spelling works
everywhere. TypeScript accepts `Unit` everywhere. This is a reference
inconsistency the port does not replicate (U3).

### S3. Consumed length before an unterminated comment (4 vectors)

`parseDcborPrefix("1 /unterminated")` reports 2 (the `/`); the reference
reports 1 (the space), because its lexer reports a failed skip from where
the skip began. Only when whitespace precedes an unterminated `/…` comment;
the parsed item agrees.

### Error spans on rejected input (S1, 13 vectors; S2, 37 vectors)

Both sides reject the same strings. The reference's error spans come from
its lexer: an unrecognised run covers its whole extent, `UnrecognizedToken`
carries the *previous* token's span, and end-of-input errors sit at the
end; TypeScript spans the offending token (S1). Where the reference's lexer
fails a whole literal (`h'zz'`, `b64'A'`, `b64'!!'`) and reports
`UnrecognizedToken`, TypeScript names the literal error
(`InvalidHexString`, `InvalidBase64String`) (S2). Spans are UTF-16
code-unit offsets in TypeScript (the language's native unit); the harness
transcodes the reference's byte offsets.

### S4. Non-ASCII digits (2 vectors)

The reference's `\d` is Unicode-aware, JavaScript's is ASCII: `٢٠٢٣-01-01`
is `InvalidDateString` there and `UnrecognizedToken` here. Both reject.

## 2. JS-only input domain

- **`NestingTooDeep` (N1, 5 vectors).** `ParseOptions.maxDepth` (1 000 by
  default) bounds the nesting of arrays, maps and tags; deeper input is
  rejected with this code. The reference has no limit: it accepts ten
  thousand levels and aborts the process beyond that. The port used to
  overflow the call stack.
- **Arguments of the wrong type (24 vectors).** A `src` that is not a
  string, `options` that is not an object or whose `tags`/`knownValues`/
  `maxDepth` has the wrong type, and compose `items` that are not an array
  of strings throw a `TypeError` from every form. The reference's types
  cannot express these.
- **The empty known-value name.** `''` resolves through `options.knownValues`
  and falls back to codepoint 0 when the resolver has no `""`; the
  reference resolves it through its global store, which indexes `""`.

## 3. Mapping equivalences

- Numbers are lexed as float64 on both sides (`parse::<f64>` /
  `parseFloat`), so integers beyond 2^53 round identically.
- String escapes are validated by the same grammar and kept verbatim on both
  sides (see U2).
- Base64 is decoded strictly on both sides: canonical padding and zero
  trailing bits, so `b64'QR=='` is `InvalidBase64String` here as there.
- A keyword directly followed by `(` is a tag name on both sides
  (`true(1)` is `UnknownTagName`), the reference's longest-match rule.
- Tag names resolve through dcbor's tags store on both sides
  (`bc_tags::register_tags()` / `registerTags(getGlobalTagsStore())`);
  known-value names through the known-values registry, which since
  known-values 1.0.0-beta.3 names the same codepoints as the reference's.
- `UnexpectedToken` carries the token's kind and source text here and the
  decoded token there; the harness compares the kind.

## 4. Upstream defects

- **U1. The reference panics** on `2023-01-01T`, `2023-12-25T10:30:45.`,
  `2023-12-25T10:30:45+0100`, `2023-12-25T10:30:45+01` and `1١` (its number
  callback unwraps a failed `f64` parse). The port rejects all five
  (`ExtraData`, `InvalidDateString`). The harness catches the panic and
  counts the row as U1 (5 vectors).
- **U2. String escapes are not processed** on either side: `"\n"` encodes
  the backslash and the `n`, so `parse(diagnostic(v))` is not the identity
  for strings containing `"` or `\`. The reference's own tests assert it.
  If the reference changes, both sides change together.
- **U3.** `Unit` rejected inside containers (D2 above).
- **U4.** `date(1` is `UnexpectedEndOfInput` where `1(1` is
  `UnmatchedParentheses`; `[1` is `UnexpectedEndOfInput` where `{1: 2` is
  `UnmatchedBraces`. Replicated.

## 5. The dcbor dependency

Date literals go through `CborDate.fromString` from
`@blockchaincommons/dcbor` (`^1.0.0-beta.3`), whose grammar and validation
equal the reference's `Date::from_string`: nanosecond fractions, offsets
below 24 hours, the `:60` leap second, years from 0000. Hex literals decode
through dcbor's `hexToBytes`.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit.
4. Update the tracked version at the top of this file.
5. Add, amend, or remove divergence entries as the port requires, and keep
   the harness classes in `tests/rust-validation/src/main.rs` in step.

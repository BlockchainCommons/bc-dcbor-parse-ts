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
differs from the Rust reference. It has three kinds of entry:

1. **True behavioral divergences** - the same input produces a different outcome.
2. **JS-only input domain** - inputs that have no Rust analog, so there is nothing to diverge from.
3. **Mapping equivalences** - JS-specific inputs that are validated through the bytes they produce.

Every entry below is checked by `tests/rust-validation`, a Rust program that
builds `dcbor-parse` at the tracked commit and replays
`tests/vectors/vectors.json` (876 vectors: the hand-written strings of both
implementations' suites, grammar-generated sources up to depth 4, and
corruptions) comparing the dCBOR hex or the error variant and span (Rust byte
offsets transcoded to UTF-16 code units). The current run: **831 match, 45
expected divergences, 0 mismatches.**

## 1. True behavioral divergences

### D2. `Unit` inside containers (3 vectors)

The reference accepts the `Unit` keyword at top level but rejects it inside
an array or map (`UnexpectedToken(Unit)`); its `''` spelling works
everywhere. TypeScript accepts `Unit` everywhere. This is a reference
inconsistency the port does not replicate.

### Resolved in Phase 3

- **P1, fractional seconds.** Date literals keep their exact digits
  (`CborDate.fromYmdHms(…, { nanoseconds })`); `…45.123456Z` encodes the
  reference's float.
- **P2, leap seconds.** `…:60Z` is second 59 plus a second of nanoseconds,
  as chrono represents it.
- **P3, keyword runs.** A keyword followed by identifier characters is one
  unrecognised token, reported at the previous token's span, as the
  reference's lexer does.

## 2. JS-only input domain

- **Error spans on rejected input (S1, 13 vectors; S2, 31 vectors).** Both
  sides reject the same strings. The reference's error spans come from
  Logos: an unrecognised run covers its whole extent, `UnrecognizedToken`
  carries the *previous* token's span, and end-of-input errors sit at the
  end; TypeScript spans the offending token. Where the reference's lexer
  fails a whole literal (`h'zz'`, `b64'A'`, `b64'!!'`) and reports
  `UnrecognizedToken`, TypeScript names the literal error
  (`InvalidHexString`, `InvalidBase64String`). Spans are UTF-16 code-unit
  offsets in TypeScript (the language's native unit); the harness transcodes
  the reference's byte offsets.

## 3. Mapping equivalences

- Numbers are lexed as float64 on both sides (`parse::<f64>` /
  `parseFloat`), so integers beyond 2^53 round identically; string escapes
  are validated but kept verbatim on both sides.
- Tag names resolve through dcbor's global tags store on both sides
  (`bc_tags::register_tags()` / `registerTags(getGlobalTagsStore())`);
  known-value names through the known-values registry.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit.
4. Update the tracked version at the top of this file.
5. Add, amend, or remove divergence entries as the port requires.

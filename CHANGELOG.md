# Changelog

## 1.0.0-beta.1

### Changed

- **API redesign.** `parseDcbor(src, options?)`, `parseDcborPrefix` (returns `{ value, length }`), `composeDcborArray`/`composeDcborMap` throw `DcborParseError` / `DcborComposeError` (`code` string unions, typed `details`, `fullMessage(source)`); the `try…` forms return `{ ok, value } | { ok, error }` without throwing. `options.tags` / `options.knownValues` choose the registries (the globals by default). The tokenizer moved to the `/lexer` subpath. Ported to canonical `@blockchaincommons/dcbor` and the redesigned known-values, tags and uniform-resources.
- Three fixes towards the Rust reference: date literals keep their exact fractional seconds (microseconds were truncated), a `:60` leap second is accepted, and a keyword running into identifier characters (`truex`) is unrecognised as a whole. The lexer uses sticky regular expressions (linear time on long documents; 2.5× faster overall with the canonical dcbor).

### Removed

- `parseDcborItem`, `parseDcborItemPartial`, `ParseResult`/`ComposeResult` and their helpers (`ok`, `err`, `isOk`, `isErr`, `unwrap`, `unwrapErr`, `errorMessage`, `errorSpan`, `fullErrorMessage`, `isDefaultError`, `defaultParseError`, `defaultSpan`), the `parseError`/`composeError` factory objects, `composeErrorMessage`; the `@blockchaincommons/dcbor-compat` dependency.

Extracted from the [`paritytech/bcts`](https://github.com/paritytech/bcts) monorepo, where this library was published as `@bcts/dcbor-parse`. The public API is unchanged; see [MIGRATION.md](./MIGRATION.md).

---

## History as `@bcts/dcbor-parse`

## [1.0.0-beta.6] - 2026-07-29

### Changed

- Workspace version bump

## [1.0.0-beta.5] - 2026-07-01

### Changed

- Workspace version bump

## [1.0.0-beta.4] - 2026-06-28

### Changed

- Dependency sync

## [1.0.0-beta.3] - 2026-06-22

### Changed

- Dependencies bump

## [1.0.0-beta.2] - 2026-06-16

### Changed

- Dependencies bump

## [1.0.0-beta.1] - 2026-05-27

### Changed

- Workspace version bump

## [1.0.0-beta.0] - 2026-04-27

### Changed

- Compose / parse / token / error modules aligned with upstream `dcbor-parse` (Rust); new parity tests under `tests/parity.test.ts`.

## [1.0.0-alpha.23] - 2026-04-24

### Changed

- Workspace version bump

## [1.0.0-alpha.22] - 2026-03-01

### Changed

- Workspace version bump

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Workspace version bump

## [1.0.0-alpha.20] - 2026-02-12

### Changed

- Workspace version bump

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Workspace version bump

## [1.0.0-alpha.18] - 2025-01-31

### Changed

- Updated Rust reference implementations

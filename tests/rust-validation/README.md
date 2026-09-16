# Rust reference cross-validation

Replays `tests/vectors/vectors.json` against the tracked `dcbor-parse`
release from crates.io (the version in `.github/versions.yml`).

```sh
cd tests/rust-validation
cargo run --release -- ../vectors/vectors.json
VERBOSE=1 cargo run --release -- ../vectors/vectors.json   # print every classified row
```

Outcomes are the dCBOR hex, `hex@length` for a prefix parse, or
`throw:<Variant>[(<TokenKind>)]@start-end`. Rust spans are byte offsets; the
harness converts them to UTF-16 code units so they compare with the port's.
`bc_tags::register_tags()` registers the same tag names the port's test
adapters register. The run classifies every row (the classes are described
in `RUST_DIVERGENCES.md`): **match**, **S1–S4** and **D2** (recorded
divergences), **N1** (the port's nesting limit), **U1** (the reference
panics, the port rejects), **js-only** (inputs the reference's types cannot
express), **pending** (a divergence a later change closes), and
**MISMATCH**, which exits 1.

To validate a local checkout of the reference instead of the release, add
to `Cargo.toml`:

```toml
[patch.crates-io]
dcbor-parse = { path = "../../../../../bc-rust/bc-dcbor-parse-rust" }
```

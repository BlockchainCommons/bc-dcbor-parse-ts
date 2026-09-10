# Rust reference cross-validation (Phase 1.4)

Replays `tests/vectors/vectors.json` against `bc-dcbor-parse` 0.11.1 (the
tracked commit, via a path dependency on `Rust/bc-dcbor-parse-rust`).

```sh
cd tests/rust-validation
cargo run --release -- ../vectors/vectors.json
VERBOSE=1 cargo run --release -- ../vectors/vectors.json   # print expected divergences
```

Outcomes are the dCBOR hex, or `throw:<Variant>[(<TokenType>)]@start-end`.
Rust spans are byte offsets; the harness converts them to UTF-16 code units
so they compare with TypeScript's. `bc_tags::register_tags()` registers the
same tag names the TypeScript adapters register. Exit 0 iff no mismatch.
Not wired into CI; a manual gate at phase boundaries.

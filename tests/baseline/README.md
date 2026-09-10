# Frozen baseline build

`dcbor-parse-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/dcbor-parse` built from
commit `791062e54dba34e547efb64bb27dcbb3b99d2f14`, the pre-redesign wire-format reference. Sibling
`@blockchaincommons/*` packages are INLINED from their own frozen baseline
bundles (@blockchaincommons/crypto, @blockchaincommons/rand, @blockchaincommons/envelope, @blockchaincommons/lifehash, @blockchaincommons/sskr, @blockchaincommons/tags, @blockchaincommons/known-values, @blockchaincommons/components, @blockchaincommons/uniform-resources, @blockchaincommons/shamir), so this bundle keeps the
pre-redesign behaviour of its dependencies after they change.
`dcbor-parse-baseline.d.mts` is the public surface at that commit (Phase 0.5).

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical outcomes; it pins the sha256 below so
an accidental rebuild cannot turn the differential into a self-comparison.

Baseline commit: 791062e54dba34e547efb64bb27dcbb3b99d2f14
Baseline sha256: da66385da994134244fd05c042836798216b5f90c40b97c04984c031bbffb3f1

# Frozen build of the previous surface

`dcbor-parse-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/dcbor-parse` built from
commit `791062e54dba34e547efb64bb27dcbb3b99d2f14`, the reference for the language wire. Its sibling
`@blockchaincommons/*` dependencies (known-values, uniform-resources and the
`dcbor-compat` values of that time) are INLINED from their own frozen bundles,
so this bundle keeps their earlier behaviour after they change.
`dcbor-parse-baseline.d.mts` is the public surface at that commit.

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical outcomes; it pins the sha256 below so
an accidental rebuild cannot turn the differential into a self-comparison.

Baseline commit: 791062e54dba34e547efb64bb27dcbb3b99d2f14
Baseline sha256: 9a662e5590ac478222740d870733546279e560895911227ad24fd3e826f2854f

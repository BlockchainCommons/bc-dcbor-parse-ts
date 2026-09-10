/**
 * Baseline bundle entry (Phase 0.6): the package surface plus the inlined
 * dcbor-compat tags store, so the differential can register tag names into
 * the *bundle's own* store (the bundle never imports `@blockchaincommons/tags`).
 */
export * from "../../src/index";
import { getGlobalTagsStore } from "@blockchaincommons/dcbor-compat";

export function baselineRegisterTags(tags: readonly { value: number | bigint; name: string }[]): void {
  const store = getGlobalTagsStore();
  for (const t of tags) {
    if (store.tagForValue(t.value) === undefined) store.insert({ value: t.value, name: t.name });
  }
}

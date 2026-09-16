/** Tag registration for the working tree: into the dcbor store the parser resolves names from. */
import { getGlobalTagsStore } from "@blockchaincommons/dcbor";
import { registerTags } from "@blockchaincommons/tags";

export const currentDeps: { registerTags: () => void } = {
  registerTags: () => registerTags(getGlobalTagsStore()),
};

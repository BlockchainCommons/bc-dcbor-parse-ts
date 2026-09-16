/**
 * Runs before every test file (`vitest.config.ts` `setupFiles`).
 *
 * The known-values directory configuration is pinned to no directories, so
 * the global registry never reads the machine's `~/.known-values` and a
 * known value parses by its reference name only.
 */
import { DirectoryConfig, setDirectoryConfig } from "@blockchaincommons/known-values";

setDirectoryConfig(new DirectoryConfig());

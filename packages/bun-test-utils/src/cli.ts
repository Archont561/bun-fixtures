#!/usr/bin/env bun

import { cacheCommand, initCommand } from "@bun-test-utils/cli";
import { defineCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };

export type { InitOptions } from "@bun-test-utils/cli";
/**
 * Public CLI adapter for the bundled `@bun-test-utils/cli` workspace. The
 * command tree lives there; `mainCommand` stays here so `--version` reads the
 * published package version. These named re-exports are the visibility-only
 * `cli` surface in `scripts/public-api.txt` (ADR 0037, rule 6).
 */
export {
  addPreload,
  cacheClearCommand,
  cacheCommand,
  DEFAULT_ENTRY,
  init,
  initCommand,
} from "@bun-test-utils/cli";

export const mainCommand = defineCommand({
  meta: {
    name: "bun-test-utils",
    version: pkg.version,
    description: "General-purpose test extension for the Bun test runner",
  },
  subCommands: {
    init: initCommand,
    cache: cacheCommand,
  },
});

if (import.meta.main) {
  runMain(mainCommand);
}

#!/usr/bin/env bun

import { cacheCommand, initCommand } from "@bun-test-utils/core/cli";
/** Public CLI adapter for the internal core implementation. */
import { defineCommand, runMain } from "citty";
import pkg from "../package.json" with { type: "json" };

export * from "@bun-test-utils/core/cli";

export const mainCommand = defineCommand({
  meta: {
    name: "bun-test-utils",
    version: pkg.version,
    description: "pytest-style scoped, injectable fixtures for `bun test`",
  },
  subCommands: {
    init: initCommand,
    cache: cacheCommand,
  },
});

if (import.meta.main) {
  runMain(mainCommand);
}

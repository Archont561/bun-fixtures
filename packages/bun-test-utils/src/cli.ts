#!/usr/bin/env bun

/** Public CLI adapter for the internal core implementation. */
import { defineCommand, runMain } from "citty";
import { initCommand } from "../core/src/cli.ts";
import pkg from "../package.json" with { type: "json" };

export * from "../core/src/cli.ts";

export const mainCommand = defineCommand({
  meta: {
    name: "bun-test-utils",
    version: pkg.version,
    description: "pytest-style scoped, injectable fixtures for `bun test`",
  },
  subCommands: {
    init: initCommand,
  },
});

if (import.meta.main) {
  runMain(mainCommand);
}

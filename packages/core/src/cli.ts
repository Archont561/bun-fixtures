#!/usr/bin/env bun

/**
 * bun-test-utils CLI — built with citty.
 *
 *   bunx test-utils init [--dir <path>] [--entry <preload path>] [--force]
 *   bunx test-utils cache clear (--file <path> [--test <name>] | --all) [--dry-run]
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineCommand } from "citty";
import { parse, stringify } from "smol-toml";
import { cacheClear, describeCacheClear } from "./cache.ts";
import { BunTestUtilsError } from "./errors.ts";

export const DEFAULT_ENTRY =
  "./node_modules/@archont561/bun-test-utils/dist/plugin.js";

/**
 * Adds `entry` to `[test].preload`, preserving whatever is already there.
 * Pure — the filesystem is the caller's problem, which keeps it unit-testable.
 */
export function addPreload(
  tomlText: string,
  entry: string,
): { text: string; changed: boolean } {
  const data = (tomlText.trim() ? parse(tomlText) : {}) as Record<string, any>;
  const testSection = (data.test ??= {});
  const current = testSection.preload;
  const list: string[] =
    current === undefined
      ? []
      : Array.isArray(current)
        ? [...current]
        : [current];

  if (list.includes(entry)) return { text: tomlText, changed: false };
  list.push(entry);
  testSection.preload = list;
  return { text: `${stringify(data).trim()}\n`, changed: true };
}

export interface InitOptions {
  dir: string;
  entry: string;
  force: boolean;
}

/** The `init` command body, separated from citty so tests can call it directly. */
export async function init({
  dir,
  entry,
  force: _force,
}: InitOptions): Promise<void> {
  const root = resolve(dir);
  await mkdir(root, { recursive: true });

  const bunfigPath = join(root, "bunfig.toml");
  const existing = existsSync(bunfigPath)
    ? await readFile(bunfigPath, "utf8")
    : "";
  const hadComments = /^\s*#/m.test(existing);
  const { text, changed } = addPreload(existing, entry);

  if (changed) {
    await writeFile(bunfigPath, text);
    console.log(
      `${existing ? "updated" : "created"} bunfig.toml → [test].preload += "${entry}"`,
    );
    if (hadComments) {
      console.log(
        "  note: comments in bunfig.toml are not preserved by the TOML round-trip.",
      );
    }
  } else {
    console.log(`bunfig.toml already preloads "${entry}" — unchanged`);
  }

  console.log(
    "\nNext: compose project fixtures explicitly with test.extend():\n",
  );
  console.log('  import { test as base } from "@archont561/bun-test-utils";');
  console.log("  export const test = base.extend({});\n");
}

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Set up bunfig.toml preload for explicit test.extend() composition",
  },
  args: {
    dir: {
      type: "string",
      description: "Project directory",
      default: ".",
      valueHint: "path",
    },
    entry: {
      type: "string",
      description: "Preload entry to register",
      default: DEFAULT_ENTRY,
      valueHint: "path",
    },
    force: {
      type: "boolean",
      description:
        "Accepted for backward compatibility; init never overwrites project files",
      default: false,
    },
  },
  async run({ args }) {
    await init({ dir: args.dir, entry: args.entry, force: args.force });
  },
});

export const cacheClearCommand = defineCommand({
  meta: {
    name: "clear",
    description:
      "Delete cassettes, callback sidecars, and snapshots so they re-record on the next run",
  },
  args: {
    file: {
      type: "string",
      description: "Test file whose recordings to clear (every test in it)",
      valueHint: "path",
    },
    test: {
      type: "string",
      description: "One test name in --file to clear",
      valueHint: "name",
    },
    all: {
      type: "boolean",
      description:
        "Clear every __cassettes__/ and __snapshots__/ under the working directory",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "List the files that would be removed and delete nothing",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    try {
      const result = cacheClear({
        cwd,
        file: args.file,
        test: args.test,
        all: args.all,
        dryRun: args["dry-run"],
      });
      for (const line of describeCacheClear(result, cwd)) console.log(line);
    } catch (error) {
      // A bad scope is a usage error: print the message, not a stack trace.
      if (
        error instanceof BunTestUtilsError &&
        error.code === "INVALID_API_USAGE"
      ) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  },
});

export const cacheCommand = defineCommand({
  meta: {
    name: "cache",
    description: "Manage recorded cassettes and snapshots",
  },
  subCommands: {
    clear: cacheClearCommand,
  },
});

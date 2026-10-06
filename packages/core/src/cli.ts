#!/usr/bin/env bun

/**
 * bun-test-utils CLI — built with citty.
 *
 *   bunx bun-test-utils init [--dir <path>] [--entry <preload path>] [--force]
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineCommand } from "citty";
import { parse, stringify } from "smol-toml";

export const DEFAULT_ENTRY = "./node_modules/bun-test-utils/dist/plugin.js";

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
  console.log('  import { test as base } from "bun-test-utils";');
  console.log("  export const test = base.extend({});\n");
}

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Set up bunfig.toml preload and scaffold an extendable test.ts",
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

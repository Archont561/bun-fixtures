#!/usr/bin/env bun

/**
 * bun-test-utils CLI — built with citty.
 *
 *   bunx bun-test-utils init [--dir <path>] [--entry <preload path>] [--force]
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { defineCommand } from "citty";
import { parse, stringify } from "smol-toml";

export const DEFAULT_ENTRY = "./node_modules/bun-test-utils/dist/plugin.js";

export const TEST_TEMPLATE = `import { test as base } from "bun-test-utils";
import { stdFixtures } from "bun-test-utils/std";

/**
 * Playwright-style fixture composition. Add project fixtures to this map and
 * import the resulting test from this file in your test modules.
 */
export const test = base.extend({
  ...stdFixtures,
  config: {
    scope: "session",
    setup: async (use) => {
      await use({ env: "test" });
    },
  },
});
`;

/** @deprecated Use TEST_TEMPLATE. Kept as an internal alias for tooling. */
export const FIXTURES_TEMPLATE = TEST_TEMPLATE;

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
export async function init({ dir, entry, force }: InitOptions): Promise<void> {
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

  const testPath = join(root, "test.ts");
  if (existsSync(testPath) && !force) {
    console.log(
      "test.ts already exists — left untouched (use --force to overwrite)",
    );
  } else {
    await mkdir(dirname(testPath), { recursive: true });
    await writeFile(testPath, TEST_TEMPLATE);
    console.log(`${force ? "wrote" : "created"} test.ts`);
  }

  console.log("\nNext: import the composed test in a test file —\n");
  console.log('  import { test } from "./test";\n');
  console.log('  test("it works", async ({ tmpdir }) => {');
  console.log("    console.log(tmpdir);");
  console.log("  });\n");
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
      description: "Overwrite an existing fixtures.ts",
      default: false,
    },
  },
  async run({ args }) {
    await init({ dir: args.dir, entry: args.entry, force: args.force });
  },
});

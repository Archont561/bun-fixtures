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

export const DEFAULT_ENTRY = "./node_modules/bun-test-utils/src/plugin.ts";

export const FIXTURES_TEMPLATE = `import type { FixtureMap } from "bun-test-utils";

/**
 * Root fixtures. Any directory may add its own \`fixtures.ts\`;
 * deeper directories override shallower ones (root → leaf).
 *
 * Scopes: "session" (whole run) | "file" (per test file) | "test" (default).
 * Everything after \`await use(value)\` is teardown.
 */
export default {
  config: {
    scope: "session",
    setup: async (use) => {
      await use({ env: "test" });
    },
  },

  tmpDir: {
    setup: async (use) => {
      const dir = \`\${process.env.TMPDIR ?? "/tmp"}/test-\${crypto.randomUUID().slice(0, 8)}\`;
      await Bun.$\`mkdir -p \${dir}\`.quiet();
      await use(dir);
      await Bun.$\`rm -rf \${dir}\`.quiet();
    },
  },
} satisfies FixtureMap;
`;

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

  const fixturesPath = join(root, "fixtures.ts");
  if (existsSync(fixturesPath) && !force) {
    console.log(
      "fixtures.ts already exists — left untouched (use --force to overwrite)",
    );
  } else {
    await mkdir(dirname(fixturesPath), { recursive: true });
    await writeFile(fixturesPath, FIXTURES_TEMPLATE);
    console.log(`${force ? "wrote" : "created"} fixtures.ts`);
  }

  console.log("\nNext: in a test file —\n");
  console.log('  import { test, expect } from "bun-test-utils";\n');
  console.log('  test("it works", async ({ tmpDir }) => {');
  console.log("    expect(tmpDir).toBeTruthy();");
  console.log("  });\n");
}

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Set up bunfig.toml preload and scaffold a root fixtures.ts",
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

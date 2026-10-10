/**
 * The citty command tree for the `test-utils` binary (ADR 0037, rule 3).
 *
 * The command bodies take an injected prompter so tests can cover both the
 * interactive and the flag-only branch; citty wires them to the real process.
 */

import { relative } from "node:path";
// Leaf import: the CLI bundle must not pull in the engine entry (plugin.ts).
import { BunTestUtilsError } from "@bun-test-utils/core/errors";
import { defineCommand } from "citty";
import {
  applyCacheClear,
  describeCacheClear,
  describeScanned,
  planCacheClear,
} from "./cache.ts";
import { DEFAULT_ENTRY, init } from "./init.ts";
import { type Prompter, promptEnv, resolvePrompter } from "./prompts.ts";

export interface InitArgs {
  dir: string;
  entry: string;
  force: boolean;
  yes: boolean;
}

export interface CacheClearArgs {
  file?: string;
  test?: string;
  all?: boolean;
  "dry-run"?: boolean;
  yes: boolean;
}

/** The `init` run body. A prompter confirms before writing; null never prompts. */
export async function runInitCommand(
  args: InitArgs,
  prompter: Prompter | null,
): Promise<void> {
  await init({
    dir: args.dir,
    entry: args.entry,
    force: args.force,
    confirm: prompter ? (message) => prompter.confirm(message) : undefined,
  });
}

/**
 * The `cache clear` run body. With a prompter the matched files are shown as a
 * multi-select (all selected) and confirmed; without one the flags alone
 * decide (ADR 0037, rule 3). `--dry-run` never prompts and never deletes.
 */
export async function runCacheClearCommand(
  args: CacheClearArgs,
  prompter: Prompter | null,
  cwd: string,
): Promise<void> {
  const plan = planCacheClear({
    cwd,
    file: args.file,
    test: args.test,
    all: args.all,
  });
  const dryRun = args["dry-run"] ?? false;
  // The root is named on every path, before any prompt (ADR 0037, rule 4).
  console.log(describeScanned(plan));
  let selected = plan.files;

  // --dry-run never prompts; the resolver also never hands it a prompter.
  if (prompter && !dryRun && plan.files.length > 0) {
    const picked = await prompter.multiSelect(
      `Matched ${plan.files.length} cache file(s) under ${plan.root}. Choose which to delete`,
      plan.files.map((path) => ({
        value: path,
        label: relative(plan.root, path) || path,
      })),
    );
    if (picked === null) {
      console.log("Cancelled. Nothing was deleted.");
      return;
    }
    if (picked.length === 0) {
      console.log("No cache files selected. Nothing was deleted.");
      return;
    }
    const proceed = await prompter.confirm(`Delete ${picked.length} file(s)?`);
    if (!proceed) {
      console.log("Cancelled. Nothing was deleted.");
      return;
    }
    selected = picked;
  }

  if (!dryRun) applyCacheClear(selected);
  for (const line of describeCacheClear(plan, { removed: selected, dryRun })) {
    console.log(line);
  }
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
    yes: {
      type: "boolean",
      description: "Write without asking for confirmation",
      default: false,
    },
  },
  async run({ args }) {
    await runInitCommand(
      {
        dir: args.dir,
        entry: args.entry,
        force: args.force,
        yes: args.yes,
      },
      resolvePrompter({ yes: args.yes, dryRun: false }, promptEnv()),
    );
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
        "Clear every __cassettes__/ and __snapshots__/ under the project root",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "List the files that would be removed and delete nothing",
      default: false,
    },
    yes: {
      type: "boolean",
      description: "Delete without asking for confirmation",
      default: false,
    },
  },
  async run({ args }) {
    try {
      await runCacheClearCommand(
        {
          file: args.file,
          test: args.test,
          all: args.all,
          "dry-run": args["dry-run"],
          yes: args.yes,
        },
        resolvePrompter(
          { yes: args.yes, dryRun: args["dry-run"] },
          promptEnv(),
        ),
        process.cwd(),
      );
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

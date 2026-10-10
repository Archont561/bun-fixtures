/**
 * `bun-test-utils cache clear` planner (ADR 0036 rule 5, ADR 0037 rules 3–4).
 *
 * Plans which recordings and snapshots to delete so the next run records them
 * again, and deletes only files whose names match the runtime's conventions —
 * never a directory. Recordings are committed, so git restores a mistaken
 * delete. Planning and applying are separate so a TTY run can show the matched
 * files and confirm before anything is deleted.
 */

import { readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
// Leaf imports: the CLI bundle must not pull in the engine entry (plugin.ts).
import { BunTestUtilsError } from "@bun-test-utils/core/errors";
import { slugifyFilename } from "@bun-test-utils/core/fetch";
import { findProjectRoot } from "./root.ts";

export interface CacheClearOptions {
  /** The working directory: the base for relative `--file` paths. */
  cwd: string;
  /** A test file, absolute or relative to `cwd`. Its directory holds the cache. */
  file?: string;
  /** One test name inside `file`. Requires `file`. */
  test?: string;
  /** Every `__cassettes__/` and `__snapshots__/` directory under the project root. */
  all?: boolean;
}

export interface CacheClearPlan {
  /** Absolute paths that matched. They are deleted unless the run is a dry run. */
  files: string[];
  /** Test names in `file` the static scan could not read (templates, `test.each`). */
  unmatchedNames: number;
  /** The directory the scan covered: the `--all` project root, or `cwd` for `--file`. */
  root: string;
  /** Files the scan visited: every file under `root` for `--all`, the test file for `--file`. */
  scanned: number;
}

export interface CacheClearOutcome {
  /** Files deleted, or that would be deleted when `dryRun` is set. */
  removed: string[];
  dryRun: boolean;
}

const SKIP_DIRS = new Set(["node_modules", ".git"]);

/** Exactly one scope must be chosen (ADR 0036, rule 5). */
export function validateCacheClearScope(options: CacheClearOptions): void {
  const { file, test, all } = options;
  if (all && (file || test)) {
    throw usageError(
      "Choose one scope: --all, or --file <path> with an optional --test <name>.",
    );
  }
  if (test && !file) {
    throw usageError(
      "--test needs --file <path> so the test's directory is known.",
    );
  }
  if (!all && !file) {
    throw usageError(
      "Choose a scope: --file <path> (every test in that file), --file <path> --test <name> (one test), or --all.",
    );
  }
}

function usageError(message: string): BunTestUtilsError {
  return new BunTestUtilsError(
    "INVALID_API_USAGE",
    `[bun-test-utils/cache] ${message}`,
  );
}

/** A test name with a literal first argument: `test("x", ...)`, `it('x')`, `bunTest("x")`. */
const LITERAL_TEST =
  /(?<![\w$.])(?:test|it|bunTest)(?:\.[A-Za-z]+)*\s*\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
/** A test call whose name is not a plain literal, so the scan cannot read it. */
const DYNAMIC_TEST =
  /(?<![\w$.])(?:test|it|bunTest)(?:\.[A-Za-z]+)*\s*\(\s*(?!["'`])/g;

/**
 * Reads the test names a file declares, statically. It is a text scan, not a
 * parse, so it can miss names built at runtime. Those are counted and reported.
 */
export function scanTestNames(source: string): {
  names: string[];
  unmatched: number;
} {
  const names = new Set<string>();
  let unmatched = 0;
  for (const match of source.matchAll(LITERAL_TEST)) {
    const quote = match[1]!;
    const raw = match[2]!;
    // A template literal with an interpolation is not a fixed name.
    if (quote === "`" && raw.includes("${")) {
      unmatched++;
      continue;
    }
    names.add(raw.replace(/\\(.)/g, "$1"));
  }
  for (const _ of source.matchAll(DYNAMIC_TEST)) unmatched++;
  return { names: [...names].sort(), unmatched };
}

/** The files the runtime writes for one test, under `dir` (its test file's directory). */
function candidatesFor(dir: string, testName: string): string[] {
  const cassette = slugifyFilename(testName, "cassette");
  const snapshot = slugifyFilename(testName, "snapshot");
  return [
    join(dir, "__cassettes__", `${cassette}.json`),
    join(dir, "__cassettes__", `${cassette}.callbacks.json`),
    join(dir, "__snapshots__", `${snapshot}.snap.json`),
  ];
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Every cache file under a `__cassettes__/` or `__snapshots__/` directory. */
function collectCacheDir(dir: string, out: string[]): number {
  let scanned = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    scanned++;
    const path = join(dir, entry.name);
    if (dir.endsWith("__cassettes__") && entry.name.endsWith(".json"))
      out.push(path);
    if (dir.endsWith("__snapshots__") && entry.name.endsWith(".snap.json"))
      out.push(path);
  }
  return scanned;
}

/** Recurses `dir`, collecting cache files and counting the files visited. */
function walk(dir: string, out: string[]): number {
  let scanned = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.name === "__cassettes__" || entry.name === "__snapshots__") {
        scanned += collectCacheDir(path, out);
      } else {
        scanned += walk(path, out);
      }
    } else if (entry.isFile()) {
      scanned++;
    }
  }
  return scanned;
}

/**
 * Plans the deletion of matching cache files. With `--all` the scan root is
 * the nearest `package.json` at or above `cwd` (ADR 0037, rule 4); with no
 * such file the run is a usage error, not a quiet no-op.
 */
export function planCacheClear(options: CacheClearOptions): CacheClearPlan {
  validateCacheClearScope(options);
  const cwd = resolve(options.cwd);
  let files: string[] = [];
  let unmatchedNames = 0;
  let scanned = 0;
  let root = cwd;

  if (options.all) {
    const projectRoot = findProjectRoot(cwd);
    if (projectRoot === null) {
      throw usageError(
        "No package.json at or above the working directory. Run cache clear --all from the project root.",
      );
    }
    root = projectRoot;
    scanned = walk(root, files);
  } else {
    const file = resolve(cwd, options.file!);
    const dir = dirname(file);
    if (options.test !== undefined) {
      files = candidatesFor(dir, options.test);
    } else {
      if (!isFile(file)) {
        throw usageError(
          `No test file at ${relative(cwd, file) || file}. To clear recordings left by a deleted or renamed file, use --file <old path> --test <name>, or --all.`,
        );
      }
      const scan = scanTestNames(readFileSync(file, "utf8"));
      scanned = 1;
      unmatchedNames = scan.unmatched;
      files = scan.names.flatMap((name) => candidatesFor(dir, name));
    }
    files = files.filter(isFile);
  }

  return {
    files: [...new Set(files)].sort(),
    unmatchedNames,
    root,
    scanned,
  };
}

/** Deletes the planned files. Never called for `--dry-run` or a cancelled prompt. */
export function applyCacheClear(files: readonly string[]): void {
  for (const path of files) unlinkSync(path);
}

/**
 * Human-readable lines for a run: the outcome of the deletion, relative to
 * `plan.root`. The scanned-root line comes from `describeScanned` and is
 * printed before any prompt.
 */
export function describeCacheClear(
  plan: CacheClearPlan,
  outcome: CacheClearOutcome,
): string[] {
  const lines: string[] = [];
  const verb = outcome.dryRun ? "would remove" : "removed";
  for (const path of outcome.removed) {
    lines.push(`  ${verb} ${relative(plan.root, path) || path}`);
  }
  if (plan.files.length === 0) {
    lines.push("No cache files matched.");
  } else if (outcome.dryRun) {
    lines.push(
      `Dry run: ${outcome.removed.length} file(s) would be removed. Nothing was deleted.`,
    );
  } else {
    lines.push(
      `Deleted ${outcome.removed.length} file(s). Recordings are committed, so \`git checkout -- <path>\` restores one.`,
    );
  }
  if (plan.unmatchedNames > 0) {
    lines.push(
      `note: ${plan.unmatchedNames} test name(s) are built at runtime and cannot be matched. Clear them with --test "<name>".`,
    );
  }
  return lines;
}

/** The line naming the root the scan covered and how many files it visited. */
export function describeScanned(plan: CacheClearPlan): string {
  return `Scanned ${plan.root} (${plan.scanned} file(s)).`;
}

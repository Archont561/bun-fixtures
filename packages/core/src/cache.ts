/**
 * `bun-test-utils cache clear` (ADR 0036, rule 5).
 *
 * Deletes recordings and snapshots so the next run records them again. It
 * deletes only files whose names match the runtime's conventions, and never a
 * directory. Recordings are committed, so git restores a mistaken delete.
 */

import { readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { BunTestUtilsError } from "./errors.ts";
import { slugifyFilename } from "./fetch.ts";

export interface CacheClearOptions {
  /** The working directory: the base for relative paths and the `--all` search root. */
  cwd: string;
  /** A test file, absolute or relative to `cwd`. Its directory holds the cache. */
  file?: string;
  /** One test name inside `file`. Requires `file`. */
  test?: string;
  /** Every `__cassettes__/` and `__snapshots__/` directory under `cwd`. */
  all?: boolean;
  /** Lists the matching files and deletes nothing. */
  dryRun?: boolean;
}

export interface CacheClearResult {
  /** Absolute paths that matched. They are deleted unless `dryRun` is set. */
  files: string[];
  /** Test names in `file` the static scan could not read (templates, `test.each`). */
  unmatchedNames: number;
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
function collectCacheDir(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(dir, entry.name);
    if (dir.endsWith("__cassettes__") && entry.name.endsWith(".json"))
      out.push(path);
    if (dir.endsWith("__snapshots__") && entry.name.endsWith(".snap.json"))
      out.push(path);
  }
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.name === "__cassettes__" || entry.name === "__snapshots__") {
      collectCacheDir(path, out);
    } else {
      walk(path, out);
    }
  }
}

/** Plans, and unless `dryRun` is set performs, the deletion of matching cache files. */
export function cacheClear(options: CacheClearOptions): CacheClearResult {
  validateCacheClearScope(options);
  const cwd = resolve(options.cwd);
  const dryRun = options.dryRun ?? false;
  let files: string[] = [];
  let unmatchedNames = 0;

  if (options.all) {
    walk(cwd, files);
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
      unmatchedNames = scan.unmatched;
      files = scan.names.flatMap((name) => candidatesFor(dir, name));
    }
    files = files.filter(isFile);
  }

  files = [...new Set(files)].sort();
  if (!dryRun) {
    for (const path of files) unlinkSync(path);
  }
  return { files, unmatchedNames, dryRun };
}

/** Human-readable lines for a result, relative to `cwd`. */
export function describeCacheClear(
  result: CacheClearResult,
  cwd: string,
): string[] {
  const root = resolve(cwd);
  const lines: string[] = [];
  const verb = result.dryRun ? "would remove" : "removed";
  for (const path of result.files)
    lines.push(`  ${verb} ${relative(root, path)}`);
  if (result.files.length === 0) {
    lines.push("No cache files matched.");
  } else if (result.dryRun) {
    lines.push(
      `Dry run: ${result.files.length} file(s) would be removed. Nothing was deleted.`,
    );
  } else {
    lines.push(
      `Deleted ${result.files.length} file(s). Recordings are committed, so \`git checkout -- <path>\` restores one.`,
    );
  }
  if (result.unmatchedNames > 0) {
    lines.push(
      `note: ${result.unmatchedNames} test name(s) are built at runtime and cannot be matched. Clear them with --test "<name>".`,
    );
  }
  return lines;
}

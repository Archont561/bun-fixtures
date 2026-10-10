import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheClear, scanTestNames, validateCacheClearScope } from "@/cache.ts";
import { describe, expect, test } from "@/plugin.ts";

/** A throwaway project with one test file and cache files for each of its tests. */
function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), "bun-test-utils-cache-"));
  const dir = join(root, "suite");
  mkdirSync(join(dir, "__cassettes__"), { recursive: true });
  mkdirSync(join(dir, "__snapshots__"), { recursive: true });
  writeFileSync(
    join(dir, "api.test.ts"),
    [
      'test("fetches the greeting", () => {});',
      "test('posts a row', () => {});",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture source text, not a template
      "it(`builds ${name}`, () => {});",
      "test.each([1, 2])('adds %d', () => {});",
    ].join("\n"),
  );
  // Files for the two literal tests in api.test.ts, and one unrelated test in the same directory.
  for (const file of [
    "__cassettes__/fetches-the-greeting.json",
    "__cassettes__/fetches-the-greeting.callbacks.json",
    "__cassettes__/posts-a-row.json",
    "__snapshots__/fetches-the-greeting.snap.json",
    "__cassettes__/other-file-test.json",
    "__snapshots__/other-file-test.snap.json",
  ]) {
    writeFileSync(join(dir, file), "{}");
  }
  return { root, dir, file: join(dir, "api.test.ts") };
}

function exists(...parts: string[]): boolean {
  return existsSync(join(...parts));
}

describe("cache clear (ADR 0036)", () => {
  test("scans literal test names and counts the names it cannot read", () => {
    const { names, unmatched } = scanTestNames(
      [
        'test("alpha", () => {});',
        "test('beta', () => {});",
        "it(`gamma`, () => {});",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture source text, not a template
        "it(`delta ${x}`, () => {});",
        "test.each([1])('epsilon %d', () => {});",
        "const ok = /x/.test(value);",
      ].join("\n"),
    );
    expect(names).toEqual(["alpha", "beta", "gamma"]);
    expect(unmatched).toBe(2);
  });

  test("--file clears the recordings of every test in that file only", () => {
    const p = fixtureProject();
    const result = cacheClear({
      cwd: p.root,
      file: join("suite", "api.test.ts"),
    });
    expect(result.files.map((f) => f.slice(p.root.length + 1)).sort()).toEqual(
      [
        "suite/__cassettes__/fetches-the-greeting.callbacks.json",
        "suite/__cassettes__/fetches-the-greeting.json",
        "suite/__cassettes__/posts-a-row.json",
        "suite/__snapshots__/fetches-the-greeting.snap.json",
      ].sort(),
    );
    expect(exists(p.dir, "__cassettes__", "fetches-the-greeting.json")).toBe(
      false,
    );
    expect(exists(p.dir, "__cassettes__", "other-file-test.json")).toBe(true);
    expect(exists(p.dir, "__snapshots__", "other-file-test.snap.json")).toBe(
      true,
    );
  });

  test("--file reports the names it could not read", () => {
    const p = fixtureProject();
    const result = cacheClear({ cwd: p.root, file: p.file, dryRun: true });
    expect(result.unmatchedNames).toBe(2);
  });

  test("--file --test clears exactly one test, with the runtime's slug", () => {
    const p = fixtureProject();
    const result = cacheClear({
      cwd: p.root,
      file: p.file,
      test: "fetches the greeting",
    });
    expect(result.files).toHaveLength(3);
    expect(exists(p.dir, "__cassettes__", "fetches-the-greeting.json")).toBe(
      false,
    );
    expect(
      exists(p.dir, "__cassettes__", "fetches-the-greeting.callbacks.json"),
    ).toBe(false);
    expect(
      exists(p.dir, "__snapshots__", "fetches-the-greeting.snap.json"),
    ).toBe(false);
    expect(exists(p.dir, "__cassettes__", "posts-a-row.json")).toBe(true);
  });

  test("--dry-run lists the files and deletes nothing", () => {
    const p = fixtureProject();
    const before = readdirSync(join(p.dir, "__cassettes__")).sort();
    const result = cacheClear({ cwd: p.root, file: p.file, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
    expect(readdirSync(join(p.dir, "__cassettes__")).sort()).toEqual(before);
  });

  test("--all clears every cache file under the root, skipping node_modules", () => {
    const p = fixtureProject();
    mkdirSync(join(p.root, "node_modules", "pkg", "__cassettes__"), {
      recursive: true,
    });
    writeFileSync(
      join(p.root, "node_modules", "pkg", "__cassettes__", "keep.json"),
      "{}",
    );
    const result = cacheClear({ cwd: p.root, all: true });
    expect(result.files.some((f) => f.includes("node_modules"))).toBe(false);
    expect(exists(p.dir, "__cassettes__", "other-file-test.json")).toBe(false);
    expect(
      exists(p.root, "node_modules", "pkg", "__cassettes__", "keep.json"),
    ).toBe(true);
  });

  test("never deletes a directory, and leaves files whose names do not match", () => {
    const p = fixtureProject();
    mkdirSync(join(p.dir, "__cassettes__", "folder.json"));
    writeFileSync(join(p.dir, "__cassettes__", "notes.txt"), "keep");
    cacheClear({ cwd: p.root, all: true });
    expect(exists(p.dir, "__cassettes__", "folder.json")).toBe(true);
    expect(exists(p.dir, "__cassettes__", "notes.txt")).toBe(true);
  });

  test("with no scope, or two scopes, it is a usage error", () => {
    expect(() => validateCacheClearScope({ cwd: "." })).toThrow(
      /Choose a scope/,
    );
    expect(() =>
      validateCacheClearScope({ cwd: ".", all: true, file: "a.ts" }),
    ).toThrow(/Choose one scope/);
    expect(() => validateCacheClearScope({ cwd: ".", test: "x" })).toThrow(
      /needs --file/,
    );
  });

  test("--file for a missing file is refused with a hint", () => {
    const p = fixtureProject();
    expect(() =>
      cacheClear({ cwd: p.root, file: "suite/missing.test.ts" }),
    ).toThrow(/No test file at/);
  });
});

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyCacheClear,
  describeCacheClear,
  describeScanned,
  planCacheClear,
  scanTestNames,
  validateCacheClearScope,
} from "@/cache.ts";

/** A throwaway project with one test file and cache files for each of its tests. */
function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), "bun-test-utils-cache-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "cache-fixture", type: "module" }),
  );
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

describe("cache clear planner (ADR 0036 rule 5, ADR 0037 rules 3–4)", () => {
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

  test("--file plans the recordings of every test in that file only", () => {
    const p = fixtureProject();
    const plan = planCacheClear({
      cwd: p.root,
      file: join("suite", "api.test.ts"),
    });
    expect(plan.files.map((f) => f.slice(p.root.length + 1)).sort()).toEqual(
      [
        "suite/__cassettes__/fetches-the-greeting.callbacks.json",
        "suite/__cassettes__/fetches-the-greeting.json",
        "suite/__cassettes__/posts-a-row.json",
        "suite/__snapshots__/fetches-the-greeting.snap.json",
      ].sort(),
    );
    expect(exists(p.dir, "__cassettes__", "fetches-the-greeting.json")).toBe(
      true,
    );
    applyCacheClear(plan.files);
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
    const plan = planCacheClear({ cwd: p.root, file: p.file });
    expect(plan.unmatchedNames).toBe(2);
  });

  test("--file --test plans exactly one test, with the runtime's slug", () => {
    const p = fixtureProject();
    const plan = planCacheClear({
      cwd: p.root,
      file: p.file,
      test: "fetches the greeting",
    });
    expect(plan.files).toHaveLength(3);
    applyCacheClear(plan.files);
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

  test("--file --test with a name that has no files plans nothing", () => {
    const p = fixtureProject();
    const plan = planCacheClear({
      cwd: p.root,
      file: p.file,
      test: "no such test",
    });
    expect(plan.files).toEqual([]);
    applyCacheClear(plan.files);
    expect(exists(p.dir, "__cassettes__", "fetches-the-greeting.json")).toBe(
      true,
    );
  });

  test("--all clears every cache file under the project root, skipping node_modules", () => {
    const p = fixtureProject();
    mkdirSync(join(p.root, "node_modules", "pkg", "__cassettes__"), {
      recursive: true,
    });
    writeFileSync(
      join(p.root, "node_modules", "pkg", "__cassettes__", "keep.json"),
      "{}",
    );
    const plan = planCacheClear({ cwd: p.root, all: true });
    expect(plan.root).toBe(p.root);
    expect(plan.files.some((f) => f.includes("node_modules"))).toBe(false);
    applyCacheClear(plan.files);
    expect(exists(p.dir, "__cassettes__", "other-file-test.json")).toBe(false);
    expect(
      exists(p.root, "node_modules", "pkg", "__cassettes__", "keep.json"),
    ).toBe(true);
  });

  test("--all from a subdirectory scopes to the nearest package.json (ADR 0037)", () => {
    const outer = fixtureProject();
    // A nested package with its own caches, and a run from inside it.
    const pkg = join(outer.root, "packages", "pkg");
    mkdirSync(join(pkg, "suite", "__cassettes__"), { recursive: true });
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "pkg" }));
    writeFileSync(join(pkg, "suite", "pkg-test.json"), "{}");
    writeFileSync(
      join(pkg, "suite", "__cassettes__", "pkg-cassette.json"),
      "{}",
    );

    const plan = planCacheClear({
      cwd: join(pkg, "suite"),
      all: true,
    });
    expect(plan.root).toBe(pkg);
    applyCacheClear(plan.files);
    // The nested package's cache is cleared; the outer package's is untouched.
    expect(exists(pkg, "suite", "__cassettes__", "pkg-cassette.json")).toBe(
      false,
    );
    expect(exists(outer.dir, "__cassettes__", "other-file-test.json")).toBe(
      true,
    );
  });

  test("--all with no package.json above the working directory is a usage error", () => {
    const root = mkdtempSync(join(tmpdir(), "cli-orphan-"));
    mkdirSync(join(root, "deep"), { recursive: true });
    expect(() =>
      planCacheClear({ cwd: join(root, "deep"), all: true }),
    ).toThrow(/project root/);
  });

  test("never deletes a directory, and leaves files whose names do not match", () => {
    const p = fixtureProject();
    mkdirSync(join(p.dir, "__cassettes__", "folder.json"));
    writeFileSync(join(p.dir, "__cassettes__", "notes.txt"), "keep");
    const plan = planCacheClear({ cwd: p.root, all: true });
    applyCacheClear(plan.files);
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
      planCacheClear({ cwd: p.root, file: "suite/missing.test.ts" }),
    ).toThrow(/No test file at/);
  });

  test("the plan reports the root it scanned and how many files it visited", () => {
    const p = fixtureProject();
    const plan = planCacheClear({ cwd: p.root, all: true });
    expect(plan.root).toBe(p.root);
    // package.json, api.test.ts, and the six cache files.
    expect(plan.scanned).toBe(8);
  });

  test("a run that matches nothing prints how many files it scanned", () => {
    const root = mkdtempSync(join(tmpdir(), "cli-empty-"));
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "solo.test.ts"), "test('x', () => {});");
    const plan = planCacheClear({ cwd: root, all: true });
    expect(plan.files).toEqual([]);
    const scannedLine = describeScanned(plan);
    expect(scannedLine).toContain(root);
    expect(scannedLine).toContain("2 file(s)");
    const lines = describeCacheClear(plan, { removed: [], dryRun: false });
    expect(lines).toContain("No cache files matched.");
  });

  test("describeCacheClear reports deletes and dry runs against the root", () => {
    const p = fixtureProject();
    const plan = planCacheClear({ cwd: p.root, file: p.file });
    const dry = describeCacheClear(plan, { removed: plan.files, dryRun: true });
    expect(dry[0]).toMatch(/would remove suite/);
    expect(dry).toContain(
      `Dry run: ${plan.files.length} file(s) would be removed. Nothing was deleted.`,
    );
    const done = describeCacheClear(plan, {
      removed: plan.files,
      dryRun: false,
    });
    expect(done[0]).toMatch(/removed suite/);
    expect(done).toContain(
      `Deleted ${plan.files.length} file(s). Recordings are committed, so \`git checkout -- <path>\` restores one.`,
    );
    expect(done.join("\n")).toContain("test name(s) are built at runtime");
  });
});

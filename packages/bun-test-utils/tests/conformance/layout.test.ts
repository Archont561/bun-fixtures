import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = join(import.meta.dir, "..", "..", "..");

/** The only entrypoint form ADR-0017 allows, parameterized by package directory. */
function canonicalRunner(packageDir: string): string {
  return [
    'import { runPackageFeatures } from "@bun-test-utils/config/bdd";',
    "",
    `await runPackageFeatures("${packageDir}", import.meta);`,
  ].join("\n");
}

const MIRRORED_TESTS = {
  core: ["cli", "plugin"],
  bdd: ["index"],
  browser: ["index"],
  dom: ["index"],
  pbt: ["index"],
  snapshot: ["snapshot"],
  std: ["env", "stdio", "tmpdir"],
  vcr: ["cassette"],
} as const;

describe("internal package layout", () => {
  test("focused tests mirror the source modules they cover", () => {
    for (const [packageName, modules] of Object.entries(MIRRORED_TESTS)) {
      for (const moduleName of modules) {
        expect(
          existsSync(
            join(PACKAGES_DIR, packageName, "src", `${moduleName}.ts`),
          ),
          `${packageName}/src/${moduleName}.ts is missing`,
        ).toBe(true);
        expect(
          existsSync(
            join(PACKAGES_DIR, packageName, "tests", `${moduleName}.test.ts`),
          ),
          `${packageName}/tests/${moduleName}.test.ts is missing`,
        ).toBe(true);
      }
    }
  });

  test("every BDD runner is the one-line shared helper call", () => {
    const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const runners = packageDirs.filter((packageDir) =>
      existsSync(join(PACKAGES_DIR, packageDir, "e2e", "bdd", "features")),
    );
    expect(runners.length).toBeGreaterThan(0);

    for (const packageDir of runners) {
      const runnerPath = join(
        PACKAGES_DIR,
        packageDir,
        "e2e",
        "bdd",
        "features.test.ts",
      );
      expect(
        existsSync(runnerPath),
        `${packageDir} has features but no e2e/bdd/features.test.ts`,
      ).toBe(true);

      // Exact match, not a substring: restating cwd, globs, or the plugin
      // registration is what ADR-0017 removed (see PR #19).
      expect(
        readFileSync(runnerPath, "utf8").trim(),
        `${packageDir}/e2e/bdd/features.test.ts must be exactly the helper call`,
      ).toBe(canonicalRunner(packageDir));
    }
  });
});

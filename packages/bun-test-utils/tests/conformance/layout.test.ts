import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = join(import.meta.dir, "..", "..", "..");

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
});

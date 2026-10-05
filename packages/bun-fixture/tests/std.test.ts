/**
 * Dogfooding @bun-fixture/std in the core suite.
 *
 * The standard fixtures (`tmpdir`, `env`, `stdio`) are not called directly
 * here — they are merged into `tests/fixtures.ts` and injected by the engine,
 * so this file proves the package works the way a real consumer sees it:
 * directory discovery, name-based DI, and engine-driven LIFO teardown.
 *
 * Teardown is observed across test boundaries via module-scope breadcrumbs:
 * Bun runs tests in file order, so a later test can assert on the state the
 * previous test's teardown left behind.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TmpDirHelper } from "@bun-fixture/std";
import { describe, expect, test } from "bun-fixture";

/** Identity of the real stream writers, captured before any stdio fixture runs. */
const realStdoutWrite = process.stdout.write;
const realStderrWrite = process.stderr.write;

const ENV_KEY = "BUN_FIXTURE_DOGFOOD_ENV";

const breadcrumbs: { tmpdir?: string } = {};

describe("@bun-fixture/std", () => {
  describe("tmpdir", () => {
    test("injects a directory with helper methods", async ({ tmpdir }) => {
      const tmp: TmpDirHelper = tmpdir;
      breadcrumbs.tmpdir = tmp.dir;
      expect(tmp.dir.startsWith("/")).toBe(true);
      expect(existsSync(tmp.dir)).toBe(true);

      tmp.write("nested/scratch.txt", "written by tmpdir");
      expect(tmp.exists("nested/scratch.txt")).toBe(true);
      expect(tmp.exists("missing.txt")).toBe(false);
      expect(tmp.read("nested/scratch.txt")).toBe("written by tmpdir");
      expect(tmp.path("a", "b")).toBe(join(tmp.dir, "a", "b"));
    });

    test("gets a fresh directory and wipes the previous one", async ({
      tmpdir,
    }) => {
      const tmp: TmpDirHelper = tmpdir;
      expect(breadcrumbs.tmpdir).toBeDefined();
      // Different instance per test…
      expect(tmp.dir).not.toBe(breadcrumbs.tmpdir);
      // …and the engine's LIFO teardown ran the std fixture's cleanup.
      expect(existsSync(breadcrumbs.tmpdir!)).toBe(false);
    });
  });

  describe("env", () => {
    test("sandboxes process.env", async ({ env }) => {
      env.set(ENV_KEY, "set-by-fixture");
      expect(process.env[ENV_KEY]).toBe("set-by-fixture");
      expect(env.get(ENV_KEY)).toBe("set-by-fixture");
      expect(env.snapshot()[ENV_KEY]).toBe("set-by-fixture");
      env.delete(ENV_KEY);
      expect(process.env[ENV_KEY]).toBeUndefined();
      env.set(ENV_KEY, "set-again");
    });

    test("restores process.env on teardown", async ({ env }) => {
      // If teardown had not restored the environment, ENV_KEY would survive
      // from the previous test.
      expect(process.env[ENV_KEY]).toBeUndefined();
      expect(env.get(ENV_KEY)).toBeUndefined();
    });
  });

  describe("stdio", () => {
    test("captures stdout and stderr", async ({ stdio }) => {
      process.stdout.write("dogfood-stdout\n");
      process.stderr.write("dogfood-stderr\n");
      expect(stdio.stdout()).toContain("dogfood-stdout");
      expect(stdio.stderr()).toContain("dogfood-stderr");
      stdio.clear();
      expect(stdio.output()).toBe("");
    });

    test("restores the real streams on teardown", async () => {
      // A leaked capture would leave a wrapper installed; the identity check
      // proves teardown handed the original writers back.
      expect(process.stdout.write).toBe(realStdoutWrite);
      expect(process.stderr.write).toBe(realStderrWrite);
    });
  });
});

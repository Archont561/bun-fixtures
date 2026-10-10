/**
 * Dogfooding built-in standard fixtures through the public root API.
 *
 * The standard fixtures (`tmpdir`, `env`, `stdio`, `clock`, `seed`, and
 * `networkGuard`) are not called directly
 * here — the public `@archont561/bun-test-utils` test export composes them explicitly,
 * so this file proves the package works the way a real consumer sees it:
 * explicit composition, name-based DI, and engine-driven LIFO teardown.
 *
 * Teardown is observed across test boundaries via module-scope breadcrumbs:
 * Bun runs tests in file order, so a later test can assert on the state the
 * previous test's teardown left behind.
 */

import { afterAll, beforeAll } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@archont561/bun-test-utils";

/**
 * The cassette fixture's mode is pinned at the file level: the one cassette
 * test below keeps its callbacks in memory (`passthrough`, selected again in
 * the body), and the default `auto` mode refuses to resolve without a
 * committed cassette when CI is set (ADR 0036). A CI runner's environment
 * must not change what this suite means.
 */
const ambientVcrMode = process.env.VCR_MODE;
beforeAll(() => {
  process.env.VCR_MODE = "passthrough";
});
afterAll(() => {
  if (ambientVcrMode === undefined) delete process.env.VCR_MODE;
  else process.env.VCR_MODE = ambientVcrMode;
});

type TmpDirHelper = {
  dir: string;
  path: (...parts: string[]) => string;
  write: (relPath: string, contents: string) => void;
  read: (relPath: string) => string;
  exists: (relPath: string) => boolean;
};

/** Identity of the real stream writers, captured before any stdio fixture runs. */
const realStdoutWrite = process.stdout.write;
const realStderrWrite = process.stderr.write;

const ENV_KEY = "BUN_TEST_UTILS_DOGFOOD_ENV";

const breadcrumbs: { tmpdir?: string } = {};

describe("built-in standard fixtures", () => {
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

  test("exposes deterministic clock and random fixtures", async ({
    clock,
    seed,
  }) => {
    clock.freeze("2026-10-06T12:00:00Z");
    seed.set(40);
    expect(clock.now().toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect([Math.random(), Math.random()]).toEqual([
      0.6392705824691802, 0.8165256746578962,
    ]);
  });

  test("composes the network guard with httpMock and vcr", async ({
    networkGuard,
    httpMock,
    cassette,
  }) => {
    cassette.setMode("passthrough");
    httpMock.get(
      "https://api.example.test/handled",
      () => new Response("mocked"),
    );
    expect(await (await fetch("https://api.example.test/handled")).text()).toBe(
      "mocked",
    );
    expect(networkGuard.calls()).toEqual([]);
  });
});

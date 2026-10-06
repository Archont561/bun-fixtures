/**
 * The `tmpdir` fixture, composed the way a consumer composes it.
 *
 * `test` here is the package's own export — `baseTest.extend(stdFixtures)` —
 * so the directory arrives by name-based injection and the engine owns its
 * lifecycle. Cleanup therefore runs *after* the test body returns, which is
 * why the teardown assertion lives in the next test: Bun runs tests in file
 * order, so a module-scope breadcrumb is how a suite observes what the
 * previous test's teardown left behind.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@/index.ts";

const breadcrumbs: { dir?: string } = {};

describe("@bun-test-utils/std tmpdir", () => {
  test("injects a directory that creates, writes and reads", async ({
    tmpdir,
  }) => {
    breadcrumbs.dir = tmpdir.dir;
    expect(existsSync(tmpdir.dir)).toBe(true);
    expect(tmpdir.path("a", "b")).toBe(join(tmpdir.dir, "a", "b"));

    expect(tmpdir.exists("test.txt")).toBe(false);
    tmpdir.write("nested/test.txt", "hello std");
    expect(tmpdir.exists("nested/test.txt")).toBe(true);
    expect(tmpdir.read("nested/test.txt")).toBe("hello std");
  });

  test("engine teardown removed the previous test's directory", async () => {
    expect(breadcrumbs.dir).toBeDefined();
    expect(existsSync(breadcrumbs.dir!)).toBe(false);
  });

  test("each test gets its own directory", async ({ tmpdir }) => {
    expect(tmpdir.dir).not.toBe(breadcrumbs.dir);
    expect(existsSync(tmpdir.dir)).toBe(true);
  });
});

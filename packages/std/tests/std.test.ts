import { describe, expect, test } from "bun:test";
import { envFixture } from "../src/env.ts";
import { stdioFixture } from "../src/stdio.ts";
import { tmpdirFixture } from "../src/tmpdir.ts";

describe("@bun-fixture/std", () => {
  describe("tmpdir", () => {
    test("creates, writes, reads and cleans up directory", async () => {
      let createdDir = "";
      await tmpdirFixture.setup(
        async (tmp) => {
          createdDir = tmp.dir;
          expect(tmp.exists("test.txt")).toBe(false);
          tmp.write("nested/test.txt", "hello std");
          expect(tmp.exists("nested/test.txt")).toBe(true);
          expect(tmp.read("nested/test.txt")).toBe("hello std");
        },
        { testFile: import.meta.path },
      );
      // Verify teardown wiped directory
      const { existsSync } = await import("node:fs");
      expect(existsSync(createdDir)).toBe(false);
    });
  });

  describe("env", () => {
    test("sandboxes environment variables and restores them", async () => {
      process.env.TEST_BUN_FIXTURE_ORIG = "original";
      await envFixture.setup(
        async (env) => {
          env.set("TEST_BUN_FIXTURE_VAR", "in-test");
          env.set("TEST_BUN_FIXTURE_ORIG", "modified");
          expect(process.env.TEST_BUN_FIXTURE_VAR).toBe("in-test");
          expect(process.env.TEST_BUN_FIXTURE_ORIG).toBe("modified");
        },
        { testFile: import.meta.path },
      );
      expect(process.env.TEST_BUN_FIXTURE_VAR).toBeUndefined();
      expect(process.env.TEST_BUN_FIXTURE_ORIG).toBe("original");
      delete process.env.TEST_BUN_FIXTURE_ORIG;
    });
  });

  describe("stdio", () => {
    test("captures and clears stdout and stderr", async () => {
      await stdioFixture.setup(
        async (stdio) => {
          process.stdout.write("hello stdout\n");
          process.stderr.write("hello stderr\n");
          expect(stdio.stdout()).toContain("hello stdout");
          expect(stdio.stderr()).toContain("hello stderr");
          expect(stdio.output()).toContain("hello stdout\nhello stderr");
          stdio.clear();
          expect(stdio.stdout()).toBe("");
        },
        { testFile: import.meta.path },
      );
    });
  });
});

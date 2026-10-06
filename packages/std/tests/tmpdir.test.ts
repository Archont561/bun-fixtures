import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { tmpdirFixture } from "@/tmpdir.ts";

describe("@bun-test-utils/std tmpdir", () => {
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
    expect(existsSync(createdDir)).toBe(false);
  });
});

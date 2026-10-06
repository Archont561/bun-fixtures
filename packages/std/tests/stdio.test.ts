import { describe, expect, test } from "bun:test";
import { stdioFixture } from "@/stdio.ts";

describe("@bun-test-utils/std stdio", () => {
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

import { describe, expect, test } from "bun:test";
import { envFixture } from "@/env.ts";

describe("@bun-test-utils/std env", () => {
  test("sandboxes environment variables and restores them", async () => {
    process.env.TEST_BUN_TEST_UTILS_ORIG = "original";
    await envFixture.setup(
      async (env) => {
        env.set("TEST_BUN_TEST_UTILS_VAR", "in-test");
        env.set("TEST_BUN_TEST_UTILS_ORIG", "modified");
        expect(process.env.TEST_BUN_TEST_UTILS_VAR).toBe("in-test");
        expect(process.env.TEST_BUN_TEST_UTILS_ORIG).toBe("modified");
      },
      { testFile: import.meta.path },
    );
    expect(process.env.TEST_BUN_TEST_UTILS_VAR).toBeUndefined();
    expect(process.env.TEST_BUN_TEST_UTILS_ORIG).toBe("original");
    delete process.env.TEST_BUN_TEST_UTILS_ORIG;
  });
});

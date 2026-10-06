/**
 * The `env` fixture, composed the way a consumer composes it.
 *
 * The pre-existing variable is set at module scope — before any fixture
 * setup runs — so the sandbox has a real prior value to restore, not just a
 * key to delete. The restoration assertion lands in the following test
 * because the engine runs teardown after the test body returns.
 */

import { describe, expect, test } from "@/index.ts";

const ORIG = "TEST_BUN_TEST_UTILS_ORIG";
const ADDED = "TEST_BUN_TEST_UTILS_VAR";

process.env[ORIG] = "original";

describe("@bun-test-utils/std env", () => {
  test("sandboxes both new and pre-existing variables", async ({ env }) => {
    env.set(ADDED, "in-test");
    env.set(ORIG, "modified");
    expect(process.env[ADDED]).toBe("in-test");
    expect(process.env[ORIG]).toBe("modified");
  });

  test("engine teardown restored the environment", async () => {
    expect(process.env[ADDED]).toBeUndefined();
    expect(process.env[ORIG]).toBe("original");
    delete process.env[ORIG];
  });
});

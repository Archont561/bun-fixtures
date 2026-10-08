Feature: Standard fixtures
  Scenario: Root test exposes standard fixtures
    Given a project with bun-test-utils preloaded
    And the file "std.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("uses tmpdir env and stdio", async ({ tmpdir, env, stdio }) => {
        env.set("STD_FEATURE", "ok");
        tmpdir.write("value.txt", env.get("STD_FEATURE")!);
        process.stdout.write("captured");
        expect(tmpdir.read("value.txt")).toBe("ok");
        expect(stdio.stdout()).toContain("captured");
      });
      """
    When I run the test suite
    Then 1 test passes

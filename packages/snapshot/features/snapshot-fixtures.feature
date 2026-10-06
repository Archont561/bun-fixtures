Feature: Snapshot fixtures
  Scenario: Root test exposes snapshots
    Given a project with bun-test-utils preloaded
    And the file "snapshot.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("records a snapshot", async ({ snapshot }) => {
        snapshot.setMode("update");
        snapshot.match({ component: "card", count: 1 }, "card");
        expect(snapshot.path).toContain("__snapshots__");
      });
      """
    When I run the test suite
    Then 1 test passes

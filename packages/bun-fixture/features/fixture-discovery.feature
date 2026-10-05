Feature: Per-directory fixture discovery
  As a developer used to conftest.py
  I want each directory to contribute fixtures to the tests beneath it
  So that setup lives next to the tests that need it

  Background:
    Given a project with bun-fixture preloaded

  Scenario: Fixtures are inherited from ancestor directories
    Given the file "fixtures.ts":
      """
      export default {
        config: { scope: "session", setup: async (use) => { await use({ env: "test" }); } },
      };
      """
    And the file "tests/deep/a.test.ts":
      """
      import { test, expect } from "bun-fixture";
      test("sees the root fixture", async ({ config }) => {
        expect(config.env).toBe("test");
      });
      """
    When I run the test suite
    Then 1 test passes

  Scenario: The nearest fixtures.ts wins
    Given the file "fixtures.ts":
      """
      export default {
        origin: { setup: async (use) => { await use("root"); } },
      };
      """
    And the file "tests/fixtures.ts":
      """
      export default {
        origin: { setup: async (use) => { await use("tests"); } },
      };
      """
    And the file "tests/a.test.ts":
      """
      import { test, expect } from "bun-fixture";
      test("uses the closest definition", async ({ origin }) => {
        expect(origin).toBe("tests");
      });
      """
    When I run the test suite
    Then 1 test passes

  Scenario: Fixtures from a sibling directory are not visible
    Given the file "left/fixtures.ts":
      """
      export default {
        secret: { setup: async (use) => { await use("left-only"); } },
      };
      """
    And the file "right/a.test.ts":
      """
      import { test } from "bun-fixture";
      test("cannot see the sibling fixture", async ({ secret }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "unknown fixture \"secret\""

  Scenario: conftest.ts is recognised as well
    Given the file "conftest.ts":
      """
      export default {
        legacy: { setup: async (use) => { await use("from conftest"); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-fixture";
      test("pytest refugees feel at home", async ({ legacy }) => {
        expect(legacy).toBe("from conftest");
      });
      """
    When I run the test suite
    Then 1 test passes

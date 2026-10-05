Feature: Fixture graph validation
  As a developer
  I want mistakes in the fixture graph reported before anything runs
  So that I get a clear message instead of a confusing runtime failure

  Background:
    Given a project with bun-test-utils preloaded

  Scenario: Requesting a fixture that does not exist
    Given the file "fixtures.ts":
      """
      export default {
        real: { setup: async (use) => { await use(1); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test } from "bun-test-utils";
      test("typo", async ({ reel }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "unknown fixture \"reel\""
    And the output contains "Available: real"

  Scenario: A longer-lived fixture depending on a shorter-lived one
    Given the file "fixtures.ts":
      """
      export default {
        perTest: { scope: "test", setup: async (use) => { await use(1); } },
        perSession: { scope: "session", deps: ["perTest"], setup: async (use) => { await use(2); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test } from "bun-test-utils";
      test("bad scopes", async ({ perSession }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "scope mismatch"

  Scenario: A dependency cycle
    Given the file "fixtures.ts":
      """
      export default {
        a: { deps: ["b"], setup: async (use) => { await use(1); } },
        b: { deps: ["a"], setup: async (use) => { await use(2); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test } from "bun-test-utils";
      test("cycle", async ({ a }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "circular fixture dependency"

  Scenario: A fixture that never calls use
    Given the file "fixtures.ts":
      """
      export default {
        forgetful: { setup: async () => { /* never calls use */ } },
      };
      """
    And the file "a.test.ts":
      """
      import { test } from "bun-test-utils";
      test("forgot to publish a value", async ({ forgetful }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "finished without calling use(value)"

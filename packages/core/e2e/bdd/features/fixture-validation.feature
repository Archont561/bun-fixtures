Feature: Fixture graph validation
  As a developer using explicit fixture composition
  I want mistakes in the fixture graph reported before anything runs
  So that I get a clear message instead of a confusing runtime failure

  Background:
    Given a project with bun-test-utils preloaded

  Scenario: Requesting a fixture that does not exist
    Given the file "test.ts":
      """
      import { test as base } from "@archont561/bun-test-utils";
      export const test = base.extend({
        real: { setup: async (use) => { await use(1); } },
      });
      """
    And the file "a.test.ts":
      """
      import { test } from "./test";
      test("typo", async ({ reel }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "unknown fixture \"reel\""
    And the output contains "test.extend"

  Scenario: A longer-lived fixture depending on a shorter-lived one
    Given the file "test.ts":
      """
      import { test as base } from "@archont561/bun-test-utils";
      export const test = base.extend({
        perTest: { scope: "test", setup: async (use) => { await use(1); } },
        perSession: { scope: "session", deps: ["perTest"], setup: async (use) => { await use(2); } },
      });
      """
    And the file "a.test.ts":
      """
      import { test } from "./test";
      test("bad scopes", async ({ perSession }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "scope mismatch"

  Scenario: A dependency cycle
    Given the file "test.ts":
      """
      import { test as base } from "@archont561/bun-test-utils";
      export const test = base.extend({
        a: { deps: ["b"], setup: async (use) => { await use(1); } },
        b: { deps: ["a"], setup: async (use) => { await use(2); } },
      });
      """
    And the file "a.test.ts":
      """
      import { test } from "./test";
      test("cycle", async ({ a }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "circular fixture dependency"

  Scenario: A fixture that never calls use
    Given the file "test.ts":
      """
      import { test as base } from "@archont561/bun-test-utils";
      export const test = base.extend({
        forgetful: { setup: async () => { /* never calls use */ } },
      });
      """
    And the file "a.test.ts":
      """
      import { test } from "./test";
      test("forgot to publish a value", async ({ forgetful }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "finished without calling use(value)"

Feature: Teardown errors
  As a developer whose fixtures tear down
  I want the error that started a failure reported first
  So that a broken teardown never hides the real cause

  Background:
    Given a project with bun-test-utils preloaded

  Scenario: A failing body is reported ahead of a failing teardown
    Given the file "a.test.ts":
      """
      import { expect, test as base } from "bun-test-utils";

      export const test = base.extend({
        flaky: {
          setup: async (use) => {
            await use("value");
            throw new Error("first teardown failed");
          },
        },
      });

      test("the body fails and so does the teardown", async ({ flaky }) => {
        expect(flaky).toBe("value");
        throw new Error("body assertion failed");
      });
      """
    When I run the test suite
    Then the test run fails
    And the output contains "body assertion failed"
    And the output contains "first teardown failed"

  Scenario: A failing fixture setup is reported ahead of a sibling teardown
    Given the file "a.test.ts":
      """
      import { test as base } from "bun-test-utils";

      export const test = base.extend({
        first: {
          setup: async (use) => {
            await use("first");
            throw new Error("first teardown failed");
          },
        },
        second: {
          setup: async () => {
            throw new Error("second setup failed");
          },
        },
      });

      test("the second setup fails", async ({ first, second }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "second setup failed"
    And the output contains "first teardown failed"

  Scenario: A passing body still fails when its teardown throws
    Given the file "a.test.ts":
      """
      import { expect, test as base } from "bun-test-utils";

      export const test = base.extend({
        flaky: {
          setup: async (use) => {
            await use("value");
            throw new Error("teardown exploded");
          },
        },
      });

      test("the body passes", async ({ flaky }) => {
        expect(flaky).toBe("value");
      });
      """
    When I run the test suite
    Then the test run fails
    And the output contains "teardown exploded"

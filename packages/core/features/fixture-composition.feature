Feature: Explicit fixture composition
  As a developer
  I want fixtures to be available only through imported test.extend() chains
  So that test setup is predictable and never depends on directory walking

  Background:
    Given a project with bun-test-utils preloaded

  Scenario: Fixture files on disk are ignored until they are imported
    Given the file "fixtures.ts":
      """
      export default {
        secret: { setup: async (use) => { await use("from a fixture file"); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test } from "bun-test-utils";
      test("does not see an uncomposed fixture", async ({ secret }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "unknown fixture \"secret\""
    And the output contains "test.extend"
    And the output contains "fixtures.ts and conftest.ts are not loaded automatically"

  Scenario: test.extend makes fixtures available through an imported chain
    Given the file "test.ts":
      """
      import { test as base } from "bun-test-utils";
      export { expect } from "bun-test-utils";
      export const test = base.extend({
        config: { scope: "session", setup: async (use) => { await use({ env: "test" }); } },
      });
      """
    And the file "tests/deep/a.test.ts":
      """
      import { test, expect } from "../../test";
      test("uses the explicit fixture", async ({ config }) => {
        expect(config.env).toBe("test");
      });
      """
    When I run the test suite
    Then 1 test passes

  Scenario: Parent and sibling directories do not contribute fixtures implicitly
    Given the file "fixtures.ts":
      """
      export default {
        parentOnly: { setup: async (use) => { await use("parent"); } },
      };
      """
    And the file "left/test.ts":
      """
      import { test as base } from "bun-test-utils";
      export const test = base.extend({
        leftOnly: { setup: async (use) => { await use("left"); } },
      });
      """
    And the file "right/a.test.ts":
      """
      import { test } from "bun-test-utils";
      test("cannot see parent or sibling fixtures", async ({ parentOnly, leftOnly }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "unknown fixture \"parentOnly\""

  Scenario: Nested extend chains preserve dependency ordering
    Given the file "test.ts":
      """
      import { test as base } from "bun-test-utils";
      export { expect } from "bun-test-utils";
      const events = [];
      export const test = base.extend({
        events: { setup: async (use) => { await use(events); } },
        first: { deps: ["events"], setup: async (use, { events }) => { events.push("first"); await use(1); } },
      });
      """
    And the file "tests/test.ts":
      """
      import { test as parent } from "../test";
      export { expect } from "../test";
      export const test = parent.extend({
        second: { deps: ["first"], setup: async (use, { events }) => { events.push("second"); await use(2); } },
        third: { deps: ["second"], setup: async (use, { events }) => { events.push("third"); await use(3); } },
      });
      """
    And the file "tests/a.test.ts":
      """
      import { test, expect } from "./test";
      test("orders dependencies across explicit extends", async ({ events, third }) => {
        expect(third).toBe(3);
        expect(events).toEqual(["first", "second", "third"]);
      });
      """
    When I run the test suite
    Then 1 test passes

  Scenario: conftest.ts is ignored unless explicitly imported
    Given the file "conftest.ts":
      """
      export default {
        legacy: { setup: async (use) => { await use("from conftest"); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test } from "bun-test-utils";
      test("does not auto-load conftest", async ({ legacy }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "unknown fixture \"legacy\""
    And the output contains "fixtures.ts and conftest.ts are not loaded automatically"

Feature: Explicit fixture composition
  As a developer
  I want fixtures to be available only through imported test.extend() chains
  So that test setup is predictable and never depends on directory walking

  Background:
    Given a project with bun-test-utils preloaded


  Scenario: test.extend makes fixtures available through an imported chain
    Given the file "test.ts":
      """
      import { test as base } from "@archont561/bun-test-utils";
      export { expect } from "@archont561/bun-test-utils";
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
      import { test as base } from "@archont561/bun-test-utils";
      export const test = base.extend({
        leftOnly: { setup: async (use) => { await use("left"); } },
      });
      """
    And the file "right/a.test.ts":
      """
      import { test } from "@archont561/bun-test-utils";
      test("cannot see parent or sibling fixtures", async ({ parentOnly, leftOnly }) => {});
      """
    When I run the test suite
    Then the test run fails
    And the output contains "unknown fixture \"parentOnly\""

  Scenario: Nested extend chains preserve dependency ordering
    Given the file "test.ts":
      """
      import { test as base } from "@archont561/bun-test-utils";
      export { expect } from "@archont561/bun-test-utils";
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

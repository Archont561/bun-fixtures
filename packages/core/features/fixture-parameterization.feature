Feature: Parameterized fixtures
  As a developer
  I want a parameterized fixture to multiply the tests that use it
  So that one test body covers every variant

  Background:
    Given a project with bun-test-utils preloaded

  Scenario: One case per parameter
    Given the file "fixtures.ts":
      """
      export default {
        mode: { params: ["fast", "slow"], setup: async (use, ctx) => { await use(ctx.param); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("runs in each mode", async ({ mode }) => {
        expect(["fast", "slow"]).toContain(mode);
      });
      """
    When I run the test suite
    Then 2 tests pass
    And the output contains "runs in each mode [mode=fast]"
    And the output contains "runs in each mode [mode=slow]"

  Scenario: Two parameterized fixtures produce the cartesian product
    Given the file "fixtures.ts":
      """
      export default {
        mode: { params: ["fast", "slow"], setup: async (use, ctx) => { await use(ctx.param); } },
        region: { params: ["eu", "us"], setup: async (use, ctx) => { await use(ctx.param); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("round trips", async ({ mode, region }) => {
        expect(`${mode}/${region}`).toMatch(/^(fast|slow)\/(eu|us)$/);
      });
      """
    When I run the test suite
    Then 4 tests pass
    And the output contains "round trips [mode=fast, region=eu]"
    And the output contains "round trips [mode=slow, region=us]"

  Scenario: Parameters reach fixtures that depend on them
    Given the file "fixtures.ts":
      """
      export default {
        mode: { params: ["fast", "slow"], setup: async (use, ctx) => { await use(ctx.param); } },
        client: { setup: async (use, { mode }) => { await use(`client:${mode}`); } },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("dependent fixture is rebuilt per parameter", async ({ client }) => {
        console.log(`built ${client}`);
        expect(client).toStartWith("client:");
      });
      """
    When I run the test suite
    Then 2 tests pass
    And the output contains "built client:fast" 1 time
    And the output contains "built client:slow" 1 time

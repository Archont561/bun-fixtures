Feature: Property testing
  Scenario: Root test exposes optional property tests
    Given a project with bun-test-utils preloaded
    And the file "pbt.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test.prop(
        "addition is commutative",
        (fc) => ({ a: fc.integer(), b: fc.integer() }),
        async (_fixtures, { a, b }) => {
          expect(a + b).toBe(b + a);
        },
        { numRuns: 5 },
      );
      """
    When I run the test suite
    Then 1 test passes

  Scenario: A violated property is reported ahead of a teardown that throws
    Given a project with bun-test-utils preloaded
    And the file "teardown.test.ts":
      """
      import { expect, test as base } from "@archont561/bun-test-utils";

      export const test = base.extend({
        flaky: {
          setup: async (use) => {
            await use("value");
            throw new Error("teardown invariant broken");
          },
        },
      });

      test.prop(
        "the property fails and so does the teardown",
        (fc) => ({ n: fc.constant(6) }),
        async ({ flaky }, { n }) => {
          expect(flaky).toBe("value");
          throw new Error(`property violated for ${n}`);
        },
        { numRuns: 1 },
      );
      """
    When I run the test suite
    Then the test run fails
    And the output contains "property violated for 6"
    And the output contains "teardown invariant broken"

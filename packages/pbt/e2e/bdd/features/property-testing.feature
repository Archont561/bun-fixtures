Feature: Property testing
  Scenario: Root test exposes optional property tests
    Given a project with bun-test-utils preloaded
    And the file "pbt.test.ts":
      """
      import { expect, test } from "bun-test-utils";

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

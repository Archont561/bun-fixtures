Feature: BDD-style fluent scenarios
  Scenario: Root test exposes optional scenarios
    Given a project with bun-test-utils preloaded
    And the file "scenario.test.ts":
      """
      import { test } from "bun-test-utils";

      test.scenario("chains state")
        .given("a base value", () => ({ value: 2 }))
        .when("the value is incremented", ({ value }) => ({ result: value + 1 }))
        .then("the result is available", ({ result, expect }) => {
          expect(result).toBe(3);
        });
      """
    When I run the test suite
    Then 1 test passes

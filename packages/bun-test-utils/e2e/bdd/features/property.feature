@property
Feature: Property-based tests in a consumer project
  As a test author
  I want property tests to run through test.prop on the public package
  So that generated examples are covered by the assembled consumer API

  @property
  Scenario: Generated values satisfy a simple invariant
    Given a project with bun-test-utils preloaded
    And the file "property.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test.prop("reversing a string twice preserves it", (fc) => ({ value: fc.string() }), async (_ctx, { value }) => {
        expect(value.split("").reverse().reverse().join("")).toBe(value);
      }, { numRuns: 25, seed: 20261006 });
      """
    When I run the test suite
    Then 1 test passes

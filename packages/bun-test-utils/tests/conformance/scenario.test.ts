import { expect, test } from "bun-test-utils";
import { fc, test as pbtTest } from "bun-test-utils/pbt";

test
  .extend({})
  .scenario("public scenario chains merge state")
  .given("a value", () => ({ value: 2 }))
  .when("the value changes", ({ value }) => ({ result: value + 1 }))
  .then("the result is observable", ({ result, expect: scenarioExpect }) => {
    scenarioExpect(result).toBe(3);
  });

pbtTest.scenario
  .prop("public property scenarios run generated examples", {
    value: fc.integer({ min: 1, max: 2 }),
  })
  .given("a generated value", ({ value }) => ({ result: value + 1 }))
  .when("the result is checked", ({ result }) => ({ result }))
  .then("the result is larger", ({ result, value, expect: scenarioExpect }) => {
    scenarioExpect(result).toBeGreaterThan(value);
  });

test("public extend remains callable", () => {
  expect(typeof test.extend).toBe("function");
  expect(typeof pbtTest.scenario.prop).toBe("function");
});

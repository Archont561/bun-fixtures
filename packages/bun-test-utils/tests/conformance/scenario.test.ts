import { expect, test } from "@archont561/bun-test-utils";

test
  .extend({})
  .scenario("public scenario chains merge state")
  .given("a value", () => ({ value: 2 }))
  .given("a label", () => ({ label: "computed" }))
  .when("the value changes", ({ value }) => ({ result: value + 1 }))
  .when("the result is decorated", ({ result, label }) => ({
    decorated: `${label}:${result}`,
  }))
  .then("the result is observable", ({ result, expect: scenarioExpect }) => {
    scenarioExpect(result).toBe(3);
  })
  .then(
    "the decorated result is observable",
    ({ decorated, expect: scenarioExpect }) => {
      scenarioExpect(decorated).toBe("computed:3");
    },
  );

test.scenario
  .prop("public property scenarios run generated examples", (fc) => ({
    value: fc.integer({ min: 1, max: 2 }),
  }))
  .given("a generated value", ({ value }) => ({ result: value + 1 }))
  .when("the result is checked", ({ result }) => ({ result }))
  .then("the result is larger", ({ result, value, expect: scenarioExpect }) => {
    scenarioExpect(result).toBeGreaterThan(value);
  });

test("public extend remains callable", () => {
  expect(typeof test.extend).toBe("function");
  expect(typeof test.prop).toBe("function");
  expect(typeof test.scenario.prop).toBe("function");
});

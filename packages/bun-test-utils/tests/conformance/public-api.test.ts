import * as api from "bun-test-utils";
import { expect, test } from "bun-test-utils";

test("public root exports only describe, test, and expect", () => {
  expect(Object.keys(api).sort()).toEqual(["describe", "expect", "test"]);
});

test("capability subpaths are not exported", async () => {
  const subpaths = [
    "bun-test-utils/std",
    "bun-test-utils/pbt",
    "bun-test-utils/bdd",
  ] as string[];
  for (const specifier of subpaths) {
    await expect(import(specifier)).rejects.toThrow();
  }
});

test("property and BDD-style APIs hang off test", () => {
  expect(typeof test.prop).toBe("function");
  expect(typeof test.scenario).toBe("function");
  expect(typeof test.scenario.prop).toBe("function");
});

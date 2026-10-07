import * as api from "bun-test-utils";
import { expect, propTestSchema, test } from "bun-test-utils";
import fc from "fast-check";

test("public root exports only the approved named runtime values", () => {
  expect(Object.keys(api).sort()).toEqual([
    "describe",
    "expect",
    "propTestSchema",
    "test",
  ]);
});

test("propTestSchema returns schema records and factories unchanged", () => {
  const record = { name: fc.string() };
  const factory = (fastCheck: typeof fc) => ({ name: fastCheck.string() });

  expect(propTestSchema(record)).toBe(record);
  expect(propTestSchema(factory)).toBe(factory);
});

test.prop(
  "propTestSchema preserves record inference",
  propTestSchema({ name: fc.string() }),
  async (_fixtures, { name }) => {
    const typedName: string = name;
    expect(typeof typedName).toBe("string");
  },
  { numRuns: 3 },
);

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

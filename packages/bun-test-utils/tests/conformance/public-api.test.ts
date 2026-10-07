import * as api from "bun-test-utils";
import { expect, test } from "bun-test-utils";
import type { ScenarioContext } from "bun-test-utils/bdd";
import * as bddApi from "bun-test-utils/bdd";
import { givenStep, thenStep, whenStep } from "bun-test-utils/bdd";
import * as pbtApi from "bun-test-utils/pbt";
import { propTestSchema } from "bun-test-utils/pbt";
import fc from "fast-check";

test("public root exports only the approved runner values", () => {
  expect(Object.keys(api).sort()).toEqual(["describe", "expect", "test"]);
});

test("typed helpers are scoped to their capability subpaths", () => {
  expect(Object.keys(pbtApi).sort()).toEqual(["propTestSchema"]);
  expect(Object.keys(bddApi).sort()).toEqual([
    "givenStep",
    "thenStep",
    "whenStep",
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

test("phase-specific step wrappers return callbacks unchanged", () => {
  const given = (_ctx: ScenarioContext<object>) => ({ value: 1 });
  const when = (ctx: ScenarioContext<{ value: number }>) => ({
    result: ctx.value,
  });
  const then = (ctx: ScenarioContext<{ result: number }>) => {
    ctx.expect(ctx.result).toBe(1);
  };

  expect(givenStep<object, { value: number }>(given)).toBe(given);
  expect(whenStep<{ value: number }, { result: number }>(when)).toBe(when);
  expect(thenStep<{ result: number }>(then)).toBe(then);
});

test("other capability subpaths remain private", async () => {
  const subpaths = [
    "bun-test-utils/std",
    "bun-test-utils/dom",
    "bun-test-utils/browser",
    "bun-test-utils/vcr",
    "bun-test-utils/snapshot",
    "bun-test-utils/pbt/runner",
    "bun-test-utils/bdd/runner",
  ] as string[];
  for (const specifier of subpaths) {
    await expect(import(specifier)).rejects.toThrow();
  }
});

test("property and BDD-style runners remain on test", () => {
  expect(typeof test.prop).toBe("function");
  expect(typeof test.scenario).toBe("function");
  expect(typeof test.scenario.prop).toBe("function");
});

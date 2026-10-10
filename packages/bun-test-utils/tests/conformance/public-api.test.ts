import * as api from "@archont561/bun-test-utils";
import { expect, test } from "@archont561/bun-test-utils";
import type { ScenarioContext } from "@archont561/bun-test-utils/bdd";
import * as bddApi from "@archont561/bun-test-utils/bdd";
import { givenStep, thenStep, whenStep } from "@archont561/bun-test-utils/bdd";
import * as pbtApi from "@archont561/bun-test-utils/pbt";
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";
import * as vcrApi from "@archont561/bun-test-utils/vcr";
import {
  defineCallbackSerializer,
  registerCallbackSerializer,
  unregisterCallbackSerializer,
} from "@archont561/bun-test-utils/vcr";
import fc from "fast-check";

test("public root exports only the approved runner values", () => {
  expect(Object.keys(api).sort()).toEqual(["describe", "expect", "test"]);
});

test("typed helpers are scoped to their capability subpaths", () => {
  expect(Object.keys(pbtApi).sort()).toEqual(["defineArbitraries"]);
  expect("propTestSchema" in pbtApi).toBe(false);
  expect(Object.keys(bddApi).sort()).toEqual([
    "givenStep",
    "thenStep",
    "whenStep",
  ]);
  expect(Object.keys(vcrApi).sort()).toEqual([
    "defineCallbackSerializer",
    "registerCallbackSerializer",
    "unregisterCallbackSerializer",
  ]);
});

test("global callback serializer helpers register by exact identity", () => {
  const serializer = defineCallbackSerializer<Date>({
    name: "public-api-date",
    version: 1,
    test: () => false,
    serialize: (value) => value.getTime(),
    deserialize: (data) => new Date(data as number),
  });
  expect(registerCallbackSerializer(serializer)).toBe(serializer);
  expect(unregisterCallbackSerializer(serializer)).toBe(true);
  expect(unregisterCallbackSerializer(serializer)).toBe(false);
});

test("defineArbitraries returns arbitrary records and factories unchanged", () => {
  const record = { name: fc.string() };
  const factory = (fastCheck: typeof fc) => ({ name: fastCheck.string() });

  expect(defineArbitraries(record)).toBe(record);
  expect(defineArbitraries(factory)).toBe(factory);
});

test("defineCallbackSerializer returns serializer definitions unchanged", () => {
  const serializer = defineCallbackSerializer<Date>({
    name: "date",
    version: 2,
    test: (value) => value instanceof Date,
    serialize: (value) => value.getTime(),
    deserialize: (data) => new Date(data as number),
  });
  expect(defineCallbackSerializer(serializer)).toBe(serializer);
});

test.prop(
  "defineArbitraries preserves record inference",
  defineArbitraries({ name: fc.string() }),
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
    "@archont561/bun-test-utils/std",
    "@archont561/bun-test-utils/dom",
    "@archont561/bun-test-utils/browser",
    "@archont561/bun-test-utils/snapshot",
    "@archont561/bun-test-utils/pbt/runner",
    "@archont561/bun-test-utils/bdd/runner",
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

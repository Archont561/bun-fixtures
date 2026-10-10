/**
 * Runner factories (split out of plugin.ts — audit 2026-10-06, finding 3):
 * the per-file `test` wrapper, `test.extend()` chains and `createTest`.
 */

import {
  describe as bunDescribe,
  expect as bunExpect,
  test as bunTest,
} from "bun:test";
import { resolve } from "node:path";
import { detectFixtures } from "./detect.ts";
import { resolveOrder, scopeOf } from "./graph.ts";
import { callerFile } from "./helpers.ts";
import { enterFile, instantiate, runWithUnwind } from "./lifecycle.ts";
import { scenarioFactory } from "./scenario.ts";
import { FIXTURE_MAP_SYMBOL } from "./state.ts";
import type {
  FixtureAwareTest,
  FixtureContext,
  FixtureDef,
  FixtureMap,
  IterateFn,
  ScenarioFactory,
  TestFn,
  TestOptions,
} from "./types.ts";

export function makeTest(file: string, map: FixtureMap): TestFn {
  const abs = resolve(file);
  return (name, fn, opts?: TestOptions) => {
    const requested = opts?.fixtures ?? detectFixtures(fn, 0);
    const order = resolveOrder(requested, map, abs);
    const testName = name;

    const body = async () => {
      await enterFile(abs);
      const testStack: Array<() => Promise<void>> = [];
      const ctx: FixtureContext = { testFile: abs, testName };

      const buildAll = async (
        target: FixtureContext,
        stack: Array<() => Promise<void>>,
        names: string[],
      ) => {
        for (const fixture of names) {
          target[fixture] = await instantiate(fixture, map, target, abs, stack);
        }
      };

      // ADR 0025 — runWithUnwind, not `finally`: a teardown error must be
      // attached to the error in flight, never replace it.
      await runWithUnwind(testStack, async () => {
        if (opts?.iterate) {
          // Defer test-scope fixtures to ctx.iterate: the wrapper context
          // holds only session/file values, and each iterate() call builds
          // a fresh set of test-scope fixtures with LIFO unwind — the
          // per-sample lifecycle property runners need.
          ctx.iterate = (async <T>(
            fn2: (iterCtx: FixtureContext) => T | Promise<T>,
          ): Promise<T> => {
            const iterStack: Array<() => Promise<void>> = [];
            return runWithUnwind(iterStack, async () => {
              const iterCtx: FixtureContext = { testFile: abs, testName };
              await buildAll(iterCtx, iterStack, order);
              return await fn2(iterCtx);
            });
          }) satisfies IterateFn;
          await buildAll(
            ctx,
            testStack,
            order.filter((n) => scopeOf(map[n]!) !== "test"),
          );
        } else {
          await buildAll(ctx, testStack, order);
        }
        await fn(ctx);
      });
    };
    if (opts?.timeout === undefined) bunTest(testName, body);
    else bunTest(testName, body, opts.timeout);
  };
}

/**
 * Declares a fixture with an inferred public type.
 *
 * Capability packages use this instead of depending on the `FixtureDef` type
 * directly. It is intentionally a small identity function: the engine still
 * owns validation, dependency ordering, scopes, and teardown.
 */
export function createFixture<T>(definition: FixtureDef<T>): FixtureDef<T> {
  return definition;
}

/**
 * Creates a fixture-aware `test` bound to a specific file.
 *
 * ```ts
 * const { test, expect } = createTest(import.meta.path);
 * const dbTest = test.extend({ db });
 * dbTest("uses db", async ({ db }) => { ... });
 * ```
 */
export function createTest(testFile?: string): {
  test: FixtureAwareTest;
  describe: typeof bunDescribe;
  expect: typeof bunExpect;
} {
  const file = resolve(testFile ?? callerFile());
  return {
    test: makeAwareTest({}, file),
    describe: bunDescribe,
    expect: bunExpect,
  };
}

/** Internal companion hook: bind an existing fixture map to a specific file without changing its cache identity. */
export function createTestWithFixtures(
  testFile: string,
  fixtures: FixtureMap,
): FixtureAwareTest {
  return makeAwareTest(fixtures, resolve(testFile), false);
}

export function makeAwareTest(
  fixtures: FixtureMap = {},
  fixedFile?: string,
  cloneFixtures = true,
): FixtureAwareTest {
  const map = cloneFixtures ? { ...fixtures } : fixtures;
  const resolveFile = () => resolve(fixedFile ?? callerFile());
  const aware = ((
    name: string,
    fn: (ctx: FixtureContext) => void | Promise<void>,
    opts?: TestOptions,
  ) => {
    return makeTest(resolveFile(), map)(name, fn, opts);
  }) as FixtureAwareTest;
  aware.extend = (more) => makeAwareTest({ ...map, ...more }, fixedFile);
  aware.scenario = ((title: string) =>
    scenarioFactory(resolveFile(), map, makeTest)(title)) as ScenarioFactory;
  aware.scenario.prop = (title, strategies) =>
    scenarioFactory(resolveFile(), map, makeTest).prop(title, strategies);
  Object.defineProperty(aware, FIXTURE_MAP_SYMBOL, {
    value: map,
    enumerable: false,
  });
  return aware;
}

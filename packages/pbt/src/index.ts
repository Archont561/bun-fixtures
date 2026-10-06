import { realpathSync } from "node:fs";
import {
  BunTestUtilsError,
  test as baseTest,
  callerFile,
  createTest,
  describe,
  detectFixtures,
  expect,
  type FixtureContext,
  fixturesFor,
  type GivenChain,
  type ScenarioContext,
  type ScenarioFactory,
  type TestFn,
} from "@bun-test-utils/core";
import type { Arbitrary, Parameters as FcParameters } from "fast-check";

// `fast-check` is an `optionalDependency` of the published `bun-test-utils`
// package (see its package.json) — it is not force-installed for consumers
// who never import this subpath. A top-level dynamic import, rather than a
// static one, turns a missing dependency into this clear, actionable error
// instead of Bun's generic module-resolution failure.
let fc: typeof import("fast-check").default;
try {
  const mod = await import("fast-check");
  fc = (mod as any).default ?? (mod as any);
} catch {
  throw new BunTestUtilsError(
    "MISSING_OPTIONAL_DEPENDENCY",
    "[bun-test-utils/pbt] 'fast-check' is required for property-based testing fixtures. Install via 'bun add -d fast-check'.",
    {
      details: {
        packageName: "fast-check",
        installCommand: "bun add -d fast-check",
      },
    },
  );
}

export type { Arbitrary } from "fast-check";
export { describe, expect, fc };

export interface PropTestOptions extends FcParameters {
  fixtures?: string[];
  timeout?: number;
}

export type ArbitraryRecord = Record<string, Arbitrary<any>>;
export type GeneratedValues<T extends ArbitraryRecord> = {
  [K in keyof T]: T[K] extends Arbitrary<infer U> ? U : never;
};

export type PropTestFn<T extends ArbitraryRecord = ArbitraryRecord> = (
  fixtures: FixtureContext,
  values: GeneratedValues<T>,
) => void | Promise<void>;

export type PropFn = <T extends ArbitraryRecord>(
  title: string,
  arbs: T,
  testFn: PropTestFn<T>,
  opts?: PropTestOptions,
) => void;

/**
 * Property test runner bound to a specific test runner.
 *
 * Each generated sample — and each shrink step — runs through `ctx.iterate`,
 * so test-scoped fixtures are rebuilt and torn down (LIFO) per iteration
 * while session/file fixtures are shared across the whole property run.
 * Requested fixtures are auto-detected from the test function's destructured
 * first parameter (`async ({ db, encoder }, values) => …`) unless
 * `opts.fixtures` lists them explicitly.
 */
function makeProp(runnerTest: TestFn): PropFn {
  return function prop<T extends ArbitraryRecord>(
    title: string,
    arbs: T,
    testFn: PropTestFn<T>,
    opts?: PropTestOptions,
  ) {
    const recordArb = fc.record(arbs) as Arbitrary<GeneratedValues<T>>;
    const { fixtures, timeout, ...fcOpts } = opts ?? {};
    const requested = fixtures ?? detectFixtures(testFn, 0);

    runnerTest(
      title,
      async (ctx: FixtureContext) => {
        const property = fc.asyncProperty(
          recordArb,
          async (generated: GeneratedValues<T>) => {
            await ctx.iterate!((iterCtx) => testFn(iterCtx, generated));
          },
        );
        await fc.assert(property as any, fcOpts);
      },
      { fixtures: requested, timeout, iterate: true },
    );
  };
}

function makeScenarioProp(): ScenarioFactory["prop"] {
  return ((title: string, strategies: ArbitraryRecord) => {
    const steps: Array<{
      phase: "given" | "when" | "then";
      name: string;
      fn: (ctx: ScenarioContext<any>) => any;
    }> = [];
    let registered = false;

    const chain = {
      given(name: string, fn: (ctx: ScenarioContext<any>) => any) {
        steps.push({ phase: "given", name, fn });
        return chain;
      },
      when(name: string, fn: (ctx: ScenarioContext<any>) => any) {
        steps.push({ phase: "when", name, fn });
        return chain;
      },
      // biome-ignore lint/suspicious/noThenProperty: `then` is the fluent scenario phase.
      then(name: string, fn: (ctx: ScenarioContext<any>) => any) {
        steps.push({ phase: "then", name, fn });
        const generatedNames = new Set(Object.keys(strategies));
        const fixtureNames = [
          ...new Set(
            steps
              .flatMap((step) => detectFixtures(step.fn, 0))
              .filter(
                (name) =>
                  !generatedNames.has(name) &&
                  name in fixturesFor(callerFile()),
              ),
          ),
        ];
        if (!registered) {
          registered = true;
          prop(
            title,
            strategies,
            async (fixtures, values) => {
              const context = Object.assign(fixtures, values, { expect });
              for (const step of steps) {
                const result = await step.fn(context);
                if (
                  step.phase !== "then" &&
                  result &&
                  typeof result === "object"
                )
                  Object.assign(context, result);
              }
            },
            { fixtures: fixtureNames },
          );
        }
        return chain;
      },
    } as unknown as GivenChain;

    return chain;
  }) as ScenarioFactory["prop"];
}

/**
 * Creates a property test runner bound to a specific file.
 *
 * ```ts
 * const { prop } = createPropTest(import.meta.path);
 * ```
 */
export function createPropTest(testFile?: string) {
  const runner = createTest(testFile);

  return {
    ...runner,
    prop: makeProp(runner.test),
    fc,
  };
}

/**
 * Top-level `prop` — resolves the calling test file per call, exactly like
 * the engine's top-level `test` (a module-scope binding would pin the wrong
 * file when this package is re-exported). The per-call wrapper frame (this
 * module) is skipped via the `extraSelf` argument of `callerFile`.
 */
const SELF_PATHS = new Set(
  [
    import.meta.path,
    (() => {
      try {
        return realpathSync(import.meta.path);
      } catch {
        return import.meta.path;
      }
    })(),
  ].filter(Boolean) as string[],
);

const propCache = new Map<string, PropFn>();
const topLevelProp: PropFn = (title, arbs, testFn, opts) => {
  const file = callerFile([...SELF_PATHS]);
  let runnerProp = propCache.get(file);
  if (!runnerProp) {
    runnerProp = makeProp(createTest(file).test);
    propCache.set(file, runnerProp);
  }
  return runnerProp(title, arbs, testFn, opts);
};
export const prop: PropFn = topLevelProp;

const scenario = Object.assign(
  ((title: string) => baseTest.scenario(title)) as ScenarioFactory,
  { prop: makeScenarioProp() },
);

export const test = Object.assign(baseTest, { prop, scenario });

export default {
  fc,
  prop,
  test,
  describe,
  expect,
  createPropTest,
};

/** Public error surface, mirrored from core so subpath consumers can type catches. */
export {
  BunTestUtilsError,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";

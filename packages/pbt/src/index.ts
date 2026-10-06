import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import {
  BunTestUtilsError,
  callerFile,
  createTest,
  createTestWithFixtures,
  describe,
  detectFixtures,
  expect,
  type FixtureAwareTest,
  type FixtureContext,
  type FixtureMap,
  type GivenChain,
  type ScenarioContext,
  type ScenarioFactory,
  type TestFn,
} from "@bun-test-utils/core";

// `fast-check` is an optional dependency of the published `bun-test-utils`
// package. Load it only when a property test executes so ordinary fixture tests
// can import the root package without requiring the generator dependency.
let fcPromise: Promise<any> | undefined;

async function loadFastCheck(): Promise<any> {
  fcPromise ??= import("fast-check")
    .then((mod) => (mod as any).default ?? mod)
    .catch(() => {
      throw new BunTestUtilsError(
        "MISSING_OPTIONAL_DEPENDENCY",
        "[bun-test-utils] test.prop() requires 'fast-check'. Install via 'bun add -d fast-check'.",
        {
          details: {
            packageName: "fast-check",
            installCommand: "bun add -d fast-check",
          },
        },
      );
    });
  return fcPromise;
}

export { describe, expect };

const FIXTURE_MAP_SYMBOL = Symbol.for("bun-test-utils.fixtureMap");

export type PbtFixtureAwareTest = TestFn &
  Omit<FixtureAwareTest, "extend" | "scenario"> & {
    prop: PropFn;
    extend: (fixtures: FixtureMap) => PbtFixtureAwareTest;
    scenario: ScenarioFactory;
  };

function fixtureMapOf(test: FixtureAwareTest): FixtureMap {
  return ((test as any)[FIXTURE_MAP_SYMBOL] ?? {}) as FixtureMap;
}

function explicitTestFor(file: string, map: FixtureMap): FixtureAwareTest {
  return createTestWithFixtures(file, map);
}

export interface PropTestOptions {
  fixtures?: string[];
  timeout?: number;
  [option: string]: unknown;
}

export interface Arbitrary<T = unknown> {
  generate(mrng: any, biasFactor: number | undefined): { value: T };
  canShrinkWithoutContext(value: unknown): value is T;
  shrink(value: T, context?: unknown): unknown;
}

export type ArbitraryRecord = Record<string, Arbitrary<any>>;
export type FastCheckApi = Record<string, any>;
export type ArbitraryInput<T extends ArbitraryRecord> =
  | T
  | ((fc: FastCheckApi) => T);
export type GeneratedValues<T extends ArbitraryRecord> = {
  [K in keyof T]: T[K] extends Arbitrary<infer U> ? U : never;
};

export type PropTestFn<T extends ArbitraryRecord = ArbitraryRecord> = (
  fixtures: FixtureContext,
  values: GeneratedValues<T>,
) => void | Promise<void>;

export type PropFn = <T extends ArbitraryRecord>(
  title: string,
  arbs: ArbitraryInput<T>,
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
    arbs: ArbitraryInput<T>,
    testFn: PropTestFn<T>,
    opts?: PropTestOptions,
  ) {
    const { fixtures, timeout, ...fcOpts } = opts ?? {};
    const requested = fixtures ?? detectFixtures(testFn, 0);

    runnerTest(
      title,
      async (ctx: FixtureContext) => {
        const fc = await loadFastCheck();
        const arbitraryRecord = typeof arbs === "function" ? arbs(fc) : arbs;
        const recordArb = fc.record(arbitraryRecord) as Arbitrary<
          GeneratedValues<T>
        >;
        const property = fc.asyncProperty(
          recordArb,
          async (generated: GeneratedValues<T>) => {
            await ctx.iterate!((iterCtx) => testFn(iterCtx, generated));
          },
        );
        await fc.assert(property as any, fcOpts as any);
      },
      { fixtures: requested, timeout, iterate: true },
    );
  };
}

function makeScenarioProp(
  map: FixtureMap,
  propFn: PropFn,
): ScenarioFactory["prop"] {
  return ((title: string, strategies: ArbitraryInput<ArbitraryRecord>) => {
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
        const generatedNames = new Set(
          typeof strategies === "function" ? [] : Object.keys(strategies),
        );
        const fixtureNames = [
          ...new Set(
            steps
              .flatMap((step) => detectFixtures(step.fn, 0))
              .filter((name) => !generatedNames.has(name) && name in map),
          ),
        ];
        if (!registered) {
          registered = true;
          propFn(
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
  const file = resolve(testFile ?? callerFile([...SELF_PATHS]));
  const runner = createTest(file);
  const test = makePbtTest(fixtureMapOf(runner.test), file);

  return {
    ...runner,
    test,
    prop: test.prop,
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

function makeExplicitProp(
  map: FixtureMap,
  fixedFile?: string,
  runnerFor?: (file: string) => FixtureAwareTest,
): PropFn {
  const cache = new Map<string, FixtureAwareTest>();
  const getRunner =
    runnerFor ??
    ((file: string) => {
      let runner = cache.get(file);
      if (!runner) {
        runner = explicitTestFor(file, map);
        cache.set(file, runner);
      }
      return runner;
    });
  return (title, arbs, testFn, opts) => {
    const file = resolve(fixedFile ?? callerFile([...SELF_PATHS]));
    return makeProp(getRunner(file))(title, arbs, testFn, opts);
  };
}

function makePbtTest(
  fixtures: FixtureMap = {},
  fixedFile?: string,
): PbtFixtureAwareTest {
  const map = { ...fixtures };
  const runnerCache = new Map<string, FixtureAwareTest>();
  const resolveFile = () => resolve(fixedFile ?? callerFile([...SELF_PATHS]));
  const runnerFor = (file: string) => {
    let runner = runnerCache.get(file);
    if (!runner) {
      runner = explicitTestFor(file, map);
      runnerCache.set(file, runner);
    }
    return runner;
  };
  const runner = () => runnerFor(resolveFile());
  const prop = makeExplicitProp(map, fixedFile, runnerFor);
  const pbtTest = ((name: string, fn: any, opts?: any) =>
    runner()(name, fn, opts)) as unknown as PbtFixtureAwareTest;
  pbtTest.extend = (more) => makePbtTest({ ...map, ...more }, fixedFile);
  pbtTest.prop = prop;
  pbtTest.scenario = Object.assign(
    ((title: string) => runner().scenario(title)) as ScenarioFactory,
    { prop: makeScenarioProp(map, prop) },
  );
  Object.defineProperty(pbtTest, FIXTURE_MAP_SYMBOL, {
    value: map,
    enumerable: false,
  });
  return pbtTest;
}

export function withPropertyTesting(
  coreTest: FixtureAwareTest,
  fixedFile?: string,
): PbtFixtureAwareTest {
  return makePbtTest(fixtureMapOf(coreTest), fixedFile);
}

export const prop: PropFn = makeExplicitProp({});

export const test: PbtFixtureAwareTest = makePbtTest();

export default {
  prop,
  test,
  describe,
  expect,
  createPropTest,
  withPropertyTesting,
};

/** Internal error re-exports for workspace-local tests and adapters. */
export {
  BunTestUtilsError,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
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
  MissingOptionalDependencyError,
  type ScenarioContext,
  type TestFn,
} from "@bun-test-utils/core";

// `fast-check` is an optional peer of the published `bun-test-utils`
// package. Check for it only when property APIs are used so ordinary fixture
// tests can import the root package without installing the generator library.
const requireFromHere = createRequire(import.meta.url);
let fastCheckAvailable: boolean | undefined;
let fcPromise: Promise<any> | undefined;

function missingFastCheck(): MissingOptionalDependencyError {
  return new MissingOptionalDependencyError(
    "fast-check",
    "bun add -d fast-check",
    "[bun-test-utils] test.prop() requires 'fast-check'. Install via 'bun add -d fast-check'.",
  );
}

function ensureFastCheckInstalled(): void {
  if (fastCheckAvailable) return;
  if (fastCheckAvailable === false) throw missingFastCheck();
  try {
    requireFromHere.resolve("fast-check");
    fastCheckAvailable = true;
  } catch {
    fastCheckAvailable = false;
    throw missingFastCheck();
  }
}

async function loadFastCheck(): Promise<any> {
  ensureFastCheckInstalled();
  fcPromise ??= import("fast-check")
    .then((mod) => (mod as any).default ?? mod)
    .catch(() => {
      fastCheckAvailable = false;
      throw missingFastCheck();
    });
  return fcPromise;
}

export { describe, expect };

const FIXTURE_MAP_SYMBOL = Symbol.for("bun-test-utils.fixtureMap");
const SCENARIO_GUARD_SYMBOL = Symbol.for("bun-test-utils.scenarioGuard");

type ScenarioGuard = () => void;

export interface PropertyTestingOptions {
  scenarioGuard?: ScenarioGuard;
}

export type PbtScenarioPropFn = <T extends ArbitraryRecord>(
  title: string,
  strategies: ArbitraryInput<T>,
) => GivenChain<GeneratedValues<T>>;

export type PbtScenarioFactory = {
  <S extends object = Record<string, unknown>>(title: string): GivenChain<S>;
  prop: PbtScenarioPropFn;
};

export type PbtFixtureAwareTest = TestFn &
  Omit<FixtureAwareTest, "extend" | "scenario"> & {
    prop: PropFn;
    extend: (fixtures: FixtureMap) => PbtFixtureAwareTest;
    scenario: PbtScenarioFactory;
  };

function fixtureMapOf(test: FixtureAwareTest): FixtureMap {
  return ((test as any)[FIXTURE_MAP_SYMBOL] ?? {}) as FixtureMap;
}

function scenarioGuardOf(test: FixtureAwareTest): ScenarioGuard | undefined {
  return (test as any)[SCENARIO_GUARD_SYMBOL] as ScenarioGuard | undefined;
}

function explicitTestFor(file: string, map: FixtureMap): FixtureAwareTest {
  return createTestWithFixtures(file, map);
}

export interface PropTestOptions {
  fixtures?: string[];
  timeout?: number;
  [option: string]: unknown;
}

export type Arbitrary<T = unknown> = import("fast-check").Arbitrary<T>;
export type ArbitraryRecord = Record<string, Arbitrary<unknown>>;
export type FastCheckApi = typeof import("fast-check").default;
export type ArbitraryInput<T extends ArbitraryRecord> =
  | T
  | ((fc: FastCheckApi) => T);
export type GeneratedValues<T extends ArbitraryRecord> = {
  [K in keyof T]: T[K] extends Arbitrary<infer U> ? U : never;
};

/**
 * Type a reusable fast-check schema without changing its runtime value.
 * Factories receive contextual typing for `fc`, and their generated types are
 * preserved when passed to `test.prop` or `test.scenario.prop`.
 */
export function propTestSchema<T extends ArbitraryRecord>(
  schema: (fc: FastCheckApi) => T,
): (fc: FastCheckApi) => T;
export function propTestSchema<T extends ArbitraryRecord>(schema: T): T;
export function propTestSchema(
  schema: ArbitraryInput<ArbitraryRecord>,
): ArbitraryInput<ArbitraryRecord> {
  return schema;
}

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
    ensureFastCheckInstalled();
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
  scenarioGuard?: ScenarioGuard,
): PbtScenarioPropFn {
  return function prop<T extends ArbitraryRecord>(
    title: string,
    strategies: ArbitraryInput<T>,
  ): GivenChain<GeneratedValues<T>> {
    scenarioGuard?.();
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
    } as unknown as GivenChain<GeneratedValues<T>>;

    return chain;
  };
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
  options: PropertyTestingOptions = {},
): PbtFixtureAwareTest {
  const map = { ...fixtures };
  const { scenarioGuard } = options;
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
  pbtTest.extend = (more) =>
    makePbtTest({ ...map, ...more }, fixedFile, options);
  pbtTest.prop = prop;
  pbtTest.scenario = Object.assign(
    ((title: string) => {
      scenarioGuard?.();
      return runner().scenario(title);
    }) as PbtScenarioFactory,
    { prop: makeScenarioProp(map, prop, scenarioGuard) },
  );
  Object.defineProperty(pbtTest, FIXTURE_MAP_SYMBOL, {
    value: map,
    enumerable: false,
  });
  if (scenarioGuard) {
    Object.defineProperty(pbtTest, SCENARIO_GUARD_SYMBOL, {
      value: scenarioGuard,
      enumerable: false,
    });
  }
  return pbtTest;
}

export function withPropertyTesting(
  coreTest: FixtureAwareTest,
  fixedFile?: string,
  options: PropertyTestingOptions = {},
): PbtFixtureAwareTest {
  return makePbtTest(fixtureMapOf(coreTest), fixedFile, {
    scenarioGuard: options.scenarioGuard ?? scenarioGuardOf(coreTest),
  });
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

import { createRequire } from "node:module";
import {
  type FixtureAwareTest,
  type FixtureContext,
  type FixtureMap,
  MissingOptionalDependencyError,
  type ScenarioFactory,
  type TestFn,
  type TestOptions,
} from "@bun-test-utils/core";

const FIXTURE_MAP_SYMBOL: unique symbol = Symbol.for(
  "bun-test-utils.fixtureMap",
);
const SCENARIO_GUARD_SYMBOL: unique symbol = Symbol.for(
  "bun-test-utils.scenarioGuard",
);

const requireFromHere = createRequire(import.meta.url);
let bddIntegrationAvailable: boolean | undefined;

/**
 * Structural view of the internal symbol tag core puts on fixture-aware test
 * functions — the narrow alternative to an `any` cast at the adapter boundary
 * (audit finding 2).
 */
interface FixtureMapCarrier {
  [FIXTURE_MAP_SYMBOL]?: FixtureMap;
}

export type BddFixtureAwareTest = TestFn &
  Omit<FixtureAwareTest, "extend" | "scenario"> & {
    extend: (fixtures: FixtureMap) => BddFixtureAwareTest;
    scenario: ScenarioFactory;
  };

function missingBddIntegration(): MissingOptionalDependencyError {
  return new MissingOptionalDependencyError(
    "@aboviq/bun-test-cucumber",
    "bun add -d @aboviq/bun-test-cucumber",
    "[bun-test-utils] test.scenario() requires '@aboviq/bun-test-cucumber'. Install via 'bun add -d @aboviq/bun-test-cucumber'.",
  );
}

export function ensureBddIntegrationInstalled(): void {
  if (bddIntegrationAvailable) return;
  if (bddIntegrationAvailable === false) throw missingBddIntegration();
  try {
    requireFromHere.resolve("@aboviq/bun-test-cucumber");
    bddIntegrationAvailable = true;
  } catch {
    bddIntegrationAvailable = false;
    throw missingBddIntegration();
  }
}

/**
 * Adds optional BDD-style scenario APIs to a core fixture-aware test runner.
 *
 * The wrapper keeps the public import surface rooted at `@archont561/bun-test-utils` while
 * making `test.scenario(...)` opt-in: ordinary tests can import and run without
 * the BDD peer, and the first scenario declaration reports a clear install
 * command if `@aboviq/bun-test-cucumber` is absent.
 */
export function withBDDTesting(
  coreTest: FixtureAwareTest,
): BddFixtureAwareTest {
  const bddTest = ((
    name: string,
    fn: (ctx: FixtureContext) => void | Promise<void>,
    opts?: TestOptions,
  ) => coreTest(name, fn, opts)) as unknown as BddFixtureAwareTest;

  bddTest.extend = (fixtures) => withBDDTesting(coreTest.extend(fixtures));
  bddTest.scenario = Object.assign(
    ((title: string) => {
      ensureBddIntegrationInstalled();
      return coreTest.scenario(title);
    }) as ScenarioFactory,
    {
      prop: (title: string, strategies: Record<string, unknown>) => {
        ensureBddIntegrationInstalled();
        return coreTest.scenario.prop(title, strategies);
      },
    },
  );

  Object.defineProperty(bddTest, SCENARIO_GUARD_SYMBOL, {
    value: ensureBddIntegrationInstalled,
    enumerable: false,
  });

  const fixtureMap = (coreTest as FixtureMapCarrier)[FIXTURE_MAP_SYMBOL];
  if (fixtureMap) {
    Object.defineProperty(bddTest, FIXTURE_MAP_SYMBOL, {
      value: fixtureMap,
      enumerable: false,
    });
  }

  return bddTest;
}

/** Internal error re-exports for workspace-local tests and adapters. */
export {
  BunTestUtilsError,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";

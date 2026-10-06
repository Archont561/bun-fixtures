import { createRequire } from "node:module";
import {
  type FixtureAwareTest,
  type FixtureContext,
  type FixtureMap,
  MissingOptionalDependencyError,
  openFixtures,
  type ScenarioFactory,
  type TestFn,
} from "@bun-test-utils/core";

const FIXTURE_MAP_SYMBOL = Symbol.for("bun-test-utils.fixtureMap");
const SCENARIO_GUARD_SYMBOL = Symbol.for("bun-test-utils.scenarioGuard");

const requireFromHere = createRequire(import.meta.url);
let bddIntegrationAvailable: boolean | undefined;

export interface BddWorld {
  [key: string]: any;
}

export interface BddHooks {
  Before(fn: (world: BddWorld) => void | Promise<void>): void;
  After(fn: (world: BddWorld) => void | Promise<void>): void;
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
 * The wrapper keeps the public import surface rooted at `bun-test-utils` while
 * making `test.scenario(...)` opt-in: ordinary tests can import and run without
 * the BDD peer, and the first scenario declaration reports a clear install
 * command if `@aboviq/bun-test-cucumber` is absent.
 */
export function withBDDTesting(
  coreTest: FixtureAwareTest,
): BddFixtureAwareTest {
  const bddTest = ((name: string, fn: any, opts?: any) =>
    coreTest(name, fn, opts)) as unknown as BddFixtureAwareTest;

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

  const fixtureMap = (coreTest as any)[FIXTURE_MAP_SYMBOL];
  if (fixtureMap) {
    Object.defineProperty(bddTest, FIXTURE_MAP_SYMBOL, {
      value: fixtureMap,
      enumerable: false,
    });
  }

  return bddTest;
}

export function fixtureSteps(
  hooks: BddHooks,
  fixtures: FixtureMap,
  names: string[],
): void {
  const scopes = new WeakMap<object, { close: () => Promise<void> }>();
  hooks.Before(async (world) => {
    const scope = await openFixtures(fixtures, names);
    Object.assign(world, scope.fixtures);
    scopes.set(world, scope);
  });
  hooks.After(async (world) => {
    const scope = scopes.get(world);
    if (scope) {
      await scope.close();
      scopes.delete(world);
    }
  });
}

/** Internal error re-exports for workspace-local tests and adapters. */
export {
  BunTestUtilsError,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";
export type { FixtureContext, FixtureMap };
export { openFixtures };

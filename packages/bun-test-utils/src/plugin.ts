/** Public entrypoint: the only user-facing API is describe, test, and expect. */

import { createRequire } from "node:module";
import { browserFixtures } from "@bun-test-utils/browser";
import {
  test as baseTest,
  describe,
  expect,
  type FixtureMap,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";
import { domFixtures } from "@bun-test-utils/dom";
import { withPropertyTesting } from "@bun-test-utils/pbt";
import { snapshotFixtures } from "@bun-test-utils/snapshot";
import { stdFixtures } from "@bun-test-utils/std";
import { vcrFixtures } from "@bun-test-utils/vcr";

const requireFromHere = createRequire(import.meta.url);
let bddIntegrationAvailable: boolean | undefined;

function missingBddIntegration(): MissingOptionalDependencyError {
  return new MissingOptionalDependencyError(
    "@aboviq/bun-test-cucumber",
    "bun add -d @aboviq/bun-test-cucumber",
    "[bun-test-utils] test.scenario() requires '@aboviq/bun-test-cucumber'. Install via 'bun add -d @aboviq/bun-test-cucumber'.",
  );
}

function ensureBddIntegrationInstalled(): void {
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

const builtInFixtures: FixtureMap = {
  ...stdFixtures,
  ...domFixtures,
  ...browserFixtures,
  ...vcrFixtures,
  ...snapshotFixtures,
};

/**
 * Fixture-aware Bun test with all built-in fixtures in its context.
 *
 * Compose project fixtures with `test.extend(...)`. Property tests are
 * available as `test.prop(...)`, and fluent BDD-style scenarios are available
 * as `test.scenario(...)` / `test.scenario.prop(...)`.
 */
export const test = withPropertyTesting(
  baseTest.extend(builtInFixtures),
  undefined,
  {
    scenarioGuard: ensureBddIntegrationInstalled,
  },
);

export { describe, expect };

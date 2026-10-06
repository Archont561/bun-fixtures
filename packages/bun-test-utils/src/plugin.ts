/** Public entrypoint for the fixture engine and the complete built-in fixture test. */

import { browserFixtures } from "@bun-test-utils/browser";
import { test as baseTest } from "@bun-test-utils/core";
import { domFixtures } from "@bun-test-utils/dom";
import { snapshotFixtures } from "@bun-test-utils/snapshot";
import { stdFixtures } from "@bun-test-utils/std";
import { vcrFixtures } from "@bun-test-utils/vcr";

export * from "@bun-test-utils/core";

/**
 * Base runner with every built-in fixture registered.
 *
 * Optional capabilities are lazy: importing this runner does not require
 * Playwright, happy-dom, or fast-check. Requesting a fixture that needs an
 * absent optional package fails during setup with an actionable install
 * command.
 */
export const test = baseTest.extend({
  ...stdFixtures,
  ...domFixtures,
  ...browserFixtures,
  ...vcrFixtures,
  ...snapshotFixtures,
});

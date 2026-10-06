import { test as baseTest, type FixtureMap } from "@bun-test-utils/core";
import { clockFixture } from "./clock.ts";
import { envFixture } from "./env.ts";
import { networkGuardFixture } from "./network-guard.ts";
import { seedFixture } from "./seed.ts";
import { stdioFixture } from "./stdio.ts";
import { tmpdirFixture } from "./tmpdir.ts";

/** Internal error re-exports for workspace-local tests and adapters. */
/** Re-exported so a suite can compose from a single import. */
export { BunTestUtilsError, describe, expect } from "@bun-test-utils/core";
export { type ClockHelper, type ClockTime, clockFixture } from "./clock.ts";
export { type EnvHelper, envFixture } from "./env.ts";
export {
  type NetworkGuardCall,
  type NetworkGuardHelper,
  type NetworkGuardMatcher,
  networkGuardFixture,
} from "./network-guard.ts";
export { type SeedHelper, seedFixture } from "./seed.ts";
export { type StdioHelper, stdioFixture } from "./stdio.ts";
export { type TmpDirHelper, tmpdirFixture } from "./tmpdir.ts";

/** Standard fixtures bundle for explicit test.extend() composition. */
export const stdFixtures: FixtureMap = {
  clock: clockFixture,
  seed: seedFixture,
  networkGuard: networkGuardFixture,
  tmpdir: tmpdirFixture,
  env: envFixture,
  stdio: stdioFixture,
};

/** Playwright-style test preconfigured with the standard fixtures. */
export const test = baseTest.extend(stdFixtures);

export default stdFixtures;

import { test as baseTest, type FixtureMap } from "@bun-test-utils/core";
import { envFixture } from "./env.ts";
import { stdioFixture } from "./stdio.ts";
import { tmpdirFixture } from "./tmpdir.ts";

/** Internal error re-exports for workspace-local tests and adapters. */
/** Re-exported so a suite can compose from a single import. */
export { BunTestUtilsError, describe, expect } from "@bun-test-utils/core";
export { type EnvHelper, envFixture } from "./env.ts";
export { type StdioHelper, stdioFixture } from "./stdio.ts";
export { type TmpDirHelper, tmpdirFixture } from "./tmpdir.ts";

/** Standard fixtures bundle for explicit test.extend() composition. */
export const stdFixtures: FixtureMap = {
  tmpdir: tmpdirFixture,
  env: envFixture,
  stdio: stdioFixture,
};

/** Playwright-style test preconfigured with the standard fixtures. */
export const test = baseTest.extend(stdFixtures);

export default stdFixtures;

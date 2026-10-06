import { test as baseTest, type FixtureMap } from "@bun-test-utils/core";
import { snapshotFixture } from "./snapshot.ts";

/** Internal error re-exports for workspace-local tests and adapters. */
/** Re-exported so a suite can compose from a single import. */
export { BunTestUtilsError, describe, expect } from "@bun-test-utils/core";
export {
  type Serializer,
  type SnapshotHelper,
  type SnapshotMode,
  snapshotFixture,
} from "./snapshot.ts";

export const snapshotFixtures: FixtureMap = {
  snapshot: snapshotFixture,
};

/** Playwright-style test preconfigured with snapshot fixtures. */
export const test = baseTest.extend(snapshotFixtures);

export default snapshotFixtures;

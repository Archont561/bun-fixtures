import type { FixtureMap } from "@bun-test-utils/core";
import { snapshotFixture } from "./snapshot.ts";

/** Public error surface, mirrored from core so subpath consumers can type catches. */
export { BunTestUtilsError } from "@bun-test-utils/core";
export {
  type Serializer,
  type SnapshotHelper,
  type SnapshotMode,
  snapshotFixture,
} from "./snapshot.ts";

export const snapshotFixtures: FixtureMap = {
  snapshot: snapshotFixture,
};

export default snapshotFixtures;

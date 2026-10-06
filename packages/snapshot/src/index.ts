import type { FixtureMap } from "../../core/src/plugin.ts";
import { snapshotFixture } from "./snapshot.ts";

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

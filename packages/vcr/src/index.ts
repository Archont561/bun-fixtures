import type { FixtureMap } from "../../core/src/plugin.ts";
import { cassetteFixture } from "./cassette.ts";

export {
  type CassetteEntry,
  type CassetteHelper,
  cassetteFixture,
  type RecordedRequest,
  type RecordedResponse,
  type VcrMode,
} from "./cassette.ts";

export const vcrFixtures: FixtureMap = {
  cassette: cassetteFixture,
};

export default vcrFixtures;

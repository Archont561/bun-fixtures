import type { FixtureMap } from "@bun-test-utils/core";
import { cassetteFixture } from "./cassette.ts";

/** Public error surface, mirrored from core so subpath consumers can type catches. */
export { BunTestUtilsError, CassetteError } from "@bun-test-utils/core";
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

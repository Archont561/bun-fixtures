import { test as baseTest, type FixtureMap } from "@bun-test-utils/core";
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

/** Playwright-style test preconfigured with the VCR fixture. */
export const test = baseTest.extend(vcrFixtures);

export default vcrFixtures;

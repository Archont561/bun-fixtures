import { test as baseTest, type FixtureMap } from "@bun-test-utils/core";
import { cassetteFixture } from "./cassette.ts";

/** Internal error re-exports for workspace-local tests and adapters. */
/** Re-exported so a suite can compose from a single import. */
export {
  BunTestUtilsError,
  CassetteError,
  describe,
  expect,
} from "@bun-test-utils/core";
export {
  type CassetteEntry,
  type CassetteHelper,
  cassetteFixture,
  type RecordedRequest,
  type RecordedResponse,
  type VcrMode,
} from "./cassette.ts";
export {
  type CallbackSerializer,
  createSerializerCodec,
  defineCallbackSerializer,
  ENVELOPE_KEY,
  type SerializerCodec,
} from "./serializers.ts";

export const vcrFixtures: FixtureMap = {
  cassette: cassetteFixture,
};

/** Playwright-style test preconfigured with the VCR fixture. */
export const test = baseTest.extend(vcrFixtures);

export default vcrFixtures;

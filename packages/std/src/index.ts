import type { FixtureMap } from "@bun-test-utils/core";
import { envFixture } from "./env.ts";
import { stdioFixture } from "./stdio.ts";
import { tmpdirFixture } from "./tmpdir.ts";

/** Public error surface, mirrored from core so subpath consumers can type catches. */
export { BunTestUtilsError } from "@bun-test-utils/core";
export { type EnvHelper, envFixture } from "./env.ts";
export { type StdioHelper, stdioFixture } from "./stdio.ts";
export { type TmpDirHelper, tmpdirFixture } from "./tmpdir.ts";

/** Standard fixtures bundle for export from fixtures.ts */
export const stdFixtures: FixtureMap = {
  tmpdir: tmpdirFixture,
  env: envFixture,
  stdio: stdioFixture,
};

export default stdFixtures;

import type { FixtureMap } from "../../core/src/plugin.ts";
import { envFixture } from "./env.ts";
import { stdioFixture } from "./stdio.ts";
import { tmpdirFixture } from "./tmpdir.ts";

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

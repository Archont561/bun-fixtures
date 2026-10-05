/**
 * Preloaded alongside `src/plugin.ts` (see bunfig.toml).
 *
 * Registers the Gherkin loader so `features/*.feature` files can be imported
 * as Bun tests, and points it at the step definitions in `tests/steps`.
 *
 * Both paths are resolved against this file, so `bun test` works from the
 * package directory and from the monorepo root.
 */

import { bunTestCucumber } from "@aboviq/bun-test-cucumber";
import { plugin } from "bun";

await plugin(
  bunTestCucumber({
    cwd: import.meta.dir,
    stepDefinitionsPattern: "tests/steps/*.steps.ts",
  }),
);

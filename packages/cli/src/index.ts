/**
 * Public surface of the bundled CLI entry (ADR 0037, rule 6).
 *
 * The stable CLI contract is the `test-utils` binary and its flags. These
 * library names stay listed in `scripts/public-api.txt` for visibility only:
 * they are not semver-covered and are not part of the documented API. The
 * planner, prompter, and run bodies stay internal to the bundle.
 */

export {
  cacheClearCommand,
  cacheCommand,
  initCommand,
} from "./commands.ts";
export type { InitOptions } from "./init.ts";
export { addPreload, DEFAULT_ENTRY, init } from "./init.ts";

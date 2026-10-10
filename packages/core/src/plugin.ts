/**
 * bun-test-utils — preload hook + fixture engine + public API.
 *
 * This module is both the optional preload script (`bunfig.toml` →
 * `[test].preload`) that installs run-global teardown hooks and the package
 * entrypoint (`import { test, expect } from "@archont561/bun-test-utils"`).
 *
 * It is a facade: the engine's internals live along stable boundaries next to
 * it (state, detect, graph, lifecycle, factory, scenario, helpers, fetch —
 * the plugin.ts split, audit 2026-10-06 finding 3), and every export that
 * existed before the split is re-exported here unchanged.
 *
 * Loading it twice is harmless: all lifecycle state lives on a global
 * singleton (state.ts).
 */

import {
  afterAll as bunAfterAll,
  describe as bunDescribe,
  expect as bunExpect,
} from "bun:test";
import { createTest, makeAwareTest } from "./factory.ts";
import { hookProcessExit, teardownSession } from "./lifecycle.ts";
import { state } from "./state.ts";
import type { FixtureAwareTest } from "./types.ts";

export {
  BunTestUtilsError,
  CassetteError,
  FixtureDependencyError,
  FixtureLifecycleError,
  FixtureScopeError,
  MissingOptionalDependencyError,
  UnknownFixtureError,
} from "./errors.ts";

export { fnv1a } from "./hash.ts";

export type {
  BunTestUtilsErrorCode,
  DiagnosticEvent,
  DiagnosticsSink,
  FixtureAwareTest,
  FixtureContext,
  FixtureDef,
  FixtureMap,
  GivenChain,
  GivenStep,
  IterateFn,
  ScenarioChain,
  ScenarioContext,
  ScenarioFactory,
  Scope,
  TestFn,
  TestOptions,
  ThenChain,
  ThenStep,
  UseFn,
  WhenChain,
  WhenStep,
} from "./types.ts";

/* Engine internals, under their stable public names. */

export {
  destructuredKeys,
  detectFixtures,
} from "./detect.ts";
export {
  createFixture,
  createTest,
  createTestWithFixtures,
} from "./factory.ts";
export type { FetchMatcher } from "./fetch.ts";
export {
  installFetchInterceptor,
  matchesFetch,
  slugifyFilename,
} from "./fetch.ts";
export { resolveOrder } from "./graph.ts";

export {
  callerFile,
  configureDiagnostics,
  reportDiagnostic,
} from "./helpers.ts";
export {
  openFixtures,
  teardownAllFiles,
  teardownFile,
  teardownSession,
} from "./lifecycle.ts";
export { executeScenarioSteps } from "./scenario.ts";

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Top-level `test()` — detects the calling file from the stack trace. */
export const test: FixtureAwareTest = makeAwareTest();

export const describe = bunDescribe;
export const expect = bunExpect;

/* -------------------------------------------------------------------------- */
/* Preload entry                                                              */
/* -------------------------------------------------------------------------- */

/**
 * When this module is loaded as a preload script, `afterAll` registers a
 * *global* hook that runs once after the whole test run — the right moment to
 * close session scope (and the last file's file scope). `beforeExit` stays as
 * a backstop for non-`bun test` usage.
 *
 * Bun scopes the hook differently depending on *when* the registering module
 * is first loaded: a module loaded during the preload phase gets a run-global
 * `afterAll`, while one first imported by a test file gets an `afterAll` that
 * fires at that file's end. Bundled builds make that distinction bite: the
 * published `dist/` copies carry their own engine instance, which shares this
 * global singleton — so a test file importing `"@archont561/bun-test-utils"` would hook a
 * mid-run session teardown and every later file would silently rebuild its
 * session fixtures. Only the first-loaded copy registers the hook; with the
 * preload in place that is the preload copy, whose hook stays run-global.
 */
try {
  if (!state.afterAllHooked) {
    state.afterAllHooked = true;
    bunAfterAll(async () => {
      await teardownSession();
    });
  }
} catch {
  // Not running under `bun test` — the process hook will have to do.
}
hookProcessExit();

export default { createTest, test, expect };

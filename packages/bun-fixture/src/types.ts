/**
 * bun-fixture — public types
 */

/** Lifetime of a fixture instance. */
export type Scope = "session" | "file" | "test";

/**
 * Runs `fn` with a fresh set of test-scoped fixtures: session- and
 * file-scoped instances are shared with the test (and across calls), while
 * test-scoped fixtures are built for this one call and torn down afterwards —
 * strictly LIFO, even when `fn` throws. Property runners use it to give every
 * generated sample and every shrink step its own fixture lifecycle.
 */
export type IterateFn = <T>(
  fn: (ctx: FixtureContext) => T | Promise<T>,
) => Promise<T>;

/**
 * The object handed to a test body (and to fixture `setup` functions).
 *
 * Resolved fixture values are exposed as plain properties keyed by fixture
 * name, alongside a few metadata fields (prefixed to avoid collisions as
 * little as possible — a fixture literally named `testFile` would shadow it).
 */
export interface FixtureContext {
  /** Absolute path of the test file that triggered the resolution. */
  testFile: string;
  /** Name of the currently running test (undefined while resolving session fixtures eagerly). */
  testName?: string;
  /** Current parameter value, when the fixture being set up declares `params`. */
  param?: any;
  /** Scope the fixture being set up is cached in. */
  scope?: Scope;
  /**
   * Per-iteration fixture runner — present only when the test was declared
   * with `opts.iterate`. With that option, test-scoped fixtures are not
   * built for the wrapper context at all; each `iterate` call builds them
   * for one sample and unwinds them afterwards.
   */
  iterate?: IterateFn;
  /** Resolved dependencies, by fixture name. */
  [fixture: string]: any;
}

/**
 * `use` hands the value to whoever requested the fixture.
 *
 * `await use(value)` suspends the setup function until the fixture's scope
 * ends — everything after the `await` is the teardown, pytest-`yield`-style.
 * Not awaiting it is allowed (the fixture then simply has no teardown).
 */
export type UseFn<T> = (value: T) => Promise<void>;

/** A fixture definition, as exported from a `fixtures.ts` / `conftest.ts` file. */
export interface FixtureDef<T = any> {
  /**
   * Builds the value. Call `use(value)` to publish it; `await use(value)` to
   * also run teardown code afterwards.
   */
  setup: (use: UseFn<T>, ctx: FixtureContext) => void | Promise<void>;
  /** Defaults to `"test"`. */
  scope?: Scope;
  /** Parameterizes the fixture: every requesting test is expanded once per param. */
  params?: T[];
  /**
   * Explicit dependency list. Optional: dependencies are auto-detected from a
   * destructured second parameter, e.g. `setup: async (use, { db }) => ...`.
   */
  deps?: string[];
}

/** The shape of a `fixtures.ts` default export. */
export type FixtureMap = Record<string, FixtureDef>;

/** Options accepted by the patched `test()`. */
export interface TestOptions {
  /**
   * Explicit fixture list. Optional: fixtures are auto-detected from a
   * destructured parameter, e.g. `test("x", async ({ db }) => ...)`.
   */
  fixtures?: string[];
  /** Per-test timeout in milliseconds, forwarded to `bun:test`. */
  timeout?: number;
  /**
   * Defer test-scoped fixtures: the test's context receives session- and
   * file-scoped values plus an `iterate` runner, and each `ctx.iterate(fn)`
   * call builds (and unwinds) the test-scoped fixtures for one sample. For
   * property-based tests and other companions that re-run a body many times
   * inside one `bun test` case.
   */
  iterate?: boolean;
}

export type TestFn = (
  name: string,
  fn: (ctx: FixtureContext) => void | Promise<void>,
  opts?: TestOptions,
) => void;

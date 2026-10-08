/**
 * bun-test-utils — public types
 */

/** Lifetime of a fixture instance. */
export type Scope = "session" | "file" | "test";

/** Stable machine-readable categories for public bun-test-utils errors. */
export type BunTestUtilsErrorCode =
  | "UNKNOWN_FIXTURE"
  | "SCOPE_MISMATCH"
  | "CIRCULAR_DEPENDENCY"
  | "FIXTURE_SETUP_FAILED"
  | "FIXTURE_USE_NOT_CALLED"
  | "FIXTURE_USE_CALLED_TWICE"
  | "MISSING_OPTIONAL_DEPENDENCY"
  | "CASSETTE_NOT_FOUND"
  | "CASSETTE_MISMATCH"
  | "CALLBACK_NOT_RECORDED"
  | "INVALID_API_USAGE";

/** Structured, opt-in diagnostics emitted by the fixture engine. */
export interface DiagnosticEvent {
  /** Stable event category for filtering and aggregation. */
  code: "FIXTURE_COMPOSITION" | "SESSION_TEARDOWN";
  /** Human-readable diagnostic message. */
  message: string;
  /** Additional context, when available. */
  details?: Record<string, unknown>;
}

/** Consumer-provided sink for optional engine diagnostics. */
export type DiagnosticsSink = (event: DiagnosticEvent) => void;

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

/** A fixture definition declared in a map passed to `test.extend()`. */
export interface FixtureDef<T = any> {
  /**
   * Builds the value. Call `use(value)` to publish it; `await use(value)` to
   * also run teardown code afterwards.
   */
  setup: (use: UseFn<T>, ctx: FixtureContext) => void | Promise<void>;
  /** Defaults to `"test"`. */
  scope?: Scope;
  /**
   * Explicit dependency list. Optional: dependencies are auto-detected from a
   * destructured second parameter, e.g. `setup: async (use, { db }) => ...`.
   */
  deps?: string[];
}

/** A named collection of fixture definitions for explicit composition. */
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

export type ScenarioContext<S extends object = Record<string, unknown>> =
  FixtureContext & S & { expect: typeof import("bun:test").expect };

/** A `given` step that may add named state for later scenario steps. */
export type GivenStep<
  Context extends object = Record<string, unknown>,
  Added extends object = object,
> = (ctx: ScenarioContext<Context>) => Added | Promise<Added>;

/** A `when` step that may add named state for later scenario steps. */
export type WhenStep<
  Context extends object = Record<string, unknown>,
  Added extends object = object,
> = (ctx: ScenarioContext<Context>) => Added | Promise<Added>;

/** A `then` step makes assertions and does not add scenario state. */
export type ThenStep<Context extends object = Record<string, unknown>> = (
  ctx: ScenarioContext<Context>,
) => void | Promise<void>;

export type GivenChain<S extends object = Record<string, unknown>> = {
  given: <N extends object>(
    name: string,
    fn: GivenStep<S, N>,
  ) => GivenChain<S & N>;
  when: <N extends object>(
    name: string,
    fn: WhenStep<S, N>,
  ) => WhenChain<S & N>;
  then: never;
};

export type ThenChain<S extends object = Record<string, unknown>> = {
  given: never;
  when: never;
  // Multiple assertions are valid in one scenario: then(...).then(...).
  then: (name: string, fn: ThenStep<S>) => ThenChain<S>;
};

export type WhenChain<S extends object = Record<string, unknown>> = {
  given: never;
  when: <N extends object>(
    name: string,
    fn: WhenStep<S, N>,
  ) => WhenChain<S & N>;
  then: (name: string, fn: ThenStep<S>) => ThenChain<S>;
};

export type ScenarioChain<S extends object = Record<string, unknown>> =
  | GivenChain<S>
  | WhenChain<S>
  | ThenChain<S>;

export type ScenarioFactory = {
  <S extends object = Record<string, unknown>>(name: string): GivenChain<S>;
  /**
   * Property scenarios are supplied by the PBT integration. The core-only
   * declaration accepts an already-built strategies record; the integration
   * replaces this with its fast-check-aware type.
   */
  prop: (name: string, strategies: Record<string, unknown>) => GivenChain;
};

export type FixtureAwareTest = TestFn & {
  extend: (fixtures: FixtureMap) => FixtureAwareTest;
  scenario: ScenarioFactory;
};

export type TestFn = (
  name: string,
  fn: (ctx: FixtureContext) => void | Promise<void>,
  opts?: TestOptions,
) => void;

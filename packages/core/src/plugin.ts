/**
 * bun-test-utils — preload hook + fixture engine + public API.
 *
 * This single module is both the optional preload script (`bunfig.toml` →
 * `[test].preload`) that installs run-global teardown hooks and the package
 * entrypoint (`import { test, expect } from "@archont561/bun-test-utils"`).
 *
 * Loading it twice is harmless: all lifecycle state lives on a global singleton.
 */

import {
  afterAll as bunAfterAll,
  describe as bunDescribe,
  expect as bunExpect,
  test as bunTest,
} from "bun:test";
import { realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import {
  FixtureDependencyError,
  FixtureLifecycleError,
  FixtureScopeError,
  UnknownFixtureError,
} from "./errors.ts";

import type {
  DiagnosticEvent,
  DiagnosticsSink,
  FixtureAwareTest,
  FixtureContext,
  FixtureDef,
  FixtureMap,
  IterateFn,
  ScenarioChain,
  ScenarioContext,
  ScenarioFactory,
  Scope,
  TestFn,
  TestOptions,
} from "./types.ts";

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

/* -------------------------------------------------------------------------- */
/* Global state                                                               */
/* -------------------------------------------------------------------------- */

interface Instance {
  value: any;
  /** Resolves the `use()` promise and waits for the setup function to finish. */
  teardown: () => Promise<void>;
}

interface State {
  session: Map<string, Instance>;
  sessionStack: Array<() => Promise<void>>;
  files: Map<
    string,
    { cache: Map<string, Instance>; stack: Array<() => Promise<void>> }
  >;
  /** Test file currently executing — used to tear down file scope on file switch. */
  currentFile: string | null;
  exitHooked: boolean;
  /** True once some loaded engine copy registered the run-global afterAll hook. */
  afterAllHooked: boolean;
  defIds: WeakMap<object, number>;
  nextDefId: number;
  mapIds: WeakMap<object, number>;
  nextMapId: number;
  diagnostics?: DiagnosticsSink;
}

/** Context keys that are metadata, not fixtures — ignored during fixture-name detection. */
const META_KEYS = new Set([
  "testFile",
  "testName",
  "param",
  "scope",
  "iterate",
]);

const SCOPE_RANK: Record<Scope, number> = { session: 0, file: 1, test: 2 };
const FIXTURE_MAP_SYMBOL = Symbol.for("bun-test-utils.fixtureMap");

const g = globalThis as any;

const state: State = (g.__BUN_TEST_UTILS__ ??= {
  session: new Map(),
  sessionStack: [],
  files: new Map(),
  currentFile: null,
  exitHooked: false,
  afterAllHooked: false,
  defIds: new WeakMap(),
  nextDefId: 1,
  mapIds: new WeakMap(),
  nextMapId: 1,
} satisfies State);

/* -------------------------------------------------------------------------- */
/* Dependency / parameter planning                                            */
/* -------------------------------------------------------------------------- */

/**
 * Auto-detection of the fixtures a function requests from its destructured
 * parameter, metadata keys excluded. Exported for companion runners
 * whose own callback signatures wrap the
 * fixture context.
 */
export function detectFixtures(
  fn: (...args: any[]) => any,
  index: number,
): string[] {
  return destructuredKeys(fn, index).filter((n) => !META_KEYS.has(n));
}

/** Extracts the identifiers of a destructured parameter: `(use, { db, api })`. */
export function destructuredKeys(
  fn: (...args: any[]) => any,
  index: number,
): string[] {
  const src = Function.prototype.toString.call(fn);
  const params = paramSource(src);
  if (params === null) return [];
  const parts = splitTopLevel(params);
  const target = parts[index];
  if (!target?.trimStart().startsWith("{")) return [];
  const body = target.trim().slice(1, target.trim().lastIndexOf("}"));
  return splitTopLevel(body)
    .map((p) => p.split(/[:=]/)[0]?.trim())
    .filter((p): p is string => Boolean(p && /^[A-Za-z_$][\w$]*$/.test(p)));
}

function paramSource(src: string): string | null {
  const arrow = src.indexOf("=>");
  const start = src.indexOf("(");
  if (start === -1) {
    // `async x => ...`
    return arrow === -1
      ? null
      : src
          .slice(0, arrow)
          .replace(/^async\s+/, "")
          .trim();
  }
  if (arrow !== -1 && arrow < start) {
    return src
      .slice(0, arrow)
      .replace(/^async\s+/, "")
      .trim();
  }
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return null;
}

function splitTopLevel(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of src) {
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

function depsOf(def: FixtureDef): string[] {
  if (def.deps) return def.deps;
  return destructuredKeys(def.setup, 1).filter((n) => !META_KEYS.has(n));
}

function scopeOf(def: FixtureDef): Scope {
  return def.scope ?? "test";
}

/** Topologically orders the requested fixtures (dependencies first). */
export function resolveOrder(
  requested: string[],
  map: FixtureMap,
  where: string,
): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string, trail: string[]) => {
    if (seen.has(name)) return;
    if (visiting.has(name)) {
      throw new FixtureDependencyError(
        `[bun-test-utils] circular fixture dependency: ${[...trail, name].join(" → ")} (${rel(where)})`,
        { trail: [...trail, name], file: where },
      );
    }
    const def = map[name];
    if (!def) {
      const available = Object.keys(map).sort();
      const known = available.join(", ") || "<none>";
      throw new UnknownFixtureError(
        name,
        available,
        where,
        `[bun-test-utils] unknown fixture "${name}" requested in ${rel(where)}. ` +
          `Available in this explicit test.extend(...) chain: ${known}. ` +
          `Compose the fixture with test.extend({ ${name}: ... }) and import that extended test into this file.`,
      );
    }
    visiting.add(name);
    for (const dep of depsOf(def)) {
      visit(dep, [...trail, name]);
      const depDef = map[dep]!;
      if (SCOPE_RANK[scopeOf(depDef)] > SCOPE_RANK[scopeOf(def)]) {
        throw new FixtureScopeError(
          `[bun-test-utils] scope mismatch: "${name}" (${scopeOf(def)}) cannot depend on ` +
            `"${dep}" (${scopeOf(depDef)}) — a fixture may only use equally or longer-lived fixtures.`,
          {
            fixture: name,
            dependency: dep,
            fixtureScope: scopeOf(def),
            dependencyScope: scopeOf(depDef),
          },
        );
      }
    }
    visiting.delete(name);
    seen.add(name);
    order.push(name);
  };

  for (const name of requested) visit(name, []);
  return order;
}

/* -------------------------------------------------------------------------- */
/* Instantiation                                                              */
/* -------------------------------------------------------------------------- */

function defId(def: FixtureDef): number {
  let id = state.defIds.get(def);
  if (!id) {
    id = state.nextDefId++;
    state.defIds.set(def, id);
  }
  return id;
}

function mapId(map: FixtureMap): number {
  let id = state.mapIds.get(map);
  if (!id) {
    id = state.nextMapId++;
    state.mapIds.set(map, id);
  }
  return id;
}

function fileState(file: string) {
  let fs = state.files.get(file);
  if (!fs) {
    fs = { cache: new Map(), stack: [] };
    state.files.set(file, fs);
  }
  return fs;
}

async function build(
  name: string,
  def: FixtureDef,
  ctx: FixtureContext,
): Promise<Instance> {
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));

  let delivered = false;
  let value: any;
  let deliver!: () => void;
  const gotValue = new Promise<void>((r) => (deliver = r));

  const use = (v: any): Promise<void> => {
    if (delivered)
      throw new FixtureLifecycleError(
        "FIXTURE_USE_CALLED_TWICE",
        `[bun-test-utils] fixture "${name}" called use() more than once`,
      );
    delivered = true;
    value = v;
    deliver();
    return released;
  };

  const fixtureCtx: FixtureContext = Object.assign(Object.create(null), ctx, {
    scope: scopeOf(def),
  });

  const run = Promise.resolve()
    .then(() => def.setup(use, fixtureCtx))
    .then(
      () => {
        if (!delivered) deliver();
      },
      (err) => {
        if (!delivered) deliver();
        throw err;
      },
    );
  // Swallow unhandled rejection; it is re-thrown below and at teardown.
  run.catch(() => {});

  await Promise.race([gotValue, run]);
  if (!delivered) {
    await run; // surfaces the setup error, if any
    throw new FixtureLifecycleError(
      "FIXTURE_USE_NOT_CALLED",
      `[bun-test-utils] fixture "${name}" finished without calling use(value)`,
    );
  }

  return {
    value,
    teardown: async () => {
      release();
      await run;
    },
  };
}

async function instantiate(
  name: string,
  map: FixtureMap,
  ctx: FixtureContext,
  file: string,
  testStack: Array<() => Promise<void>>,
): Promise<any> {
  const def = map[name]!;
  const scope = scopeOf(def);
  const key = `${mapId(map)}:${name}#${defId(def)}`;

  if (scope === "session") {
    const hit = state.session.get(key);
    if (hit) return hit.value;
    const inst = await build(name, def, ctx);
    state.session.set(key, inst);
    state.sessionStack.push(inst.teardown);
    hookProcessExit();
    return inst.value;
  }

  if (scope === "file") {
    const fs = fileState(file);
    const hit = fs.cache.get(key);
    if (hit) return hit.value;
    const inst = await build(name, def, ctx);
    fs.cache.set(key, inst);
    fs.stack.push(inst.teardown);
    return inst.value;
  }

  const inst = await build(name, def, ctx);
  testStack.push(inst.teardown);
  return inst.value;
}

/** Resolve a fixture map for integrations that manage their own lifecycle. */
export async function openFixtures(
  map: FixtureMap,
  names: string[],
  context: Partial<FixtureContext> = {},
): Promise<{ fixtures: FixtureContext; close: () => Promise<void> }> {
  const file = context.testFile ?? callerFile();
  const order = resolveOrder(names, map, file);
  const stack: Array<() => Promise<void>> = [];
  const fixtures = Object.assign(Object.create(null), context, {
    testFile: file,
    scope: "test" as const,
  }) as FixtureContext;
  try {
    for (const name of order) {
      fixtures[name] = await instantiate(name, map, fixtures, file, stack);
    }
  } catch (error) {
    // A failed open never returns close(), so tear down what was built and
    // rethrow the setup failure. The setup error is the one the caller needs;
    // ADR 0025 attaches the cleanup errors to it rather than dropping them,
    // which reverses the drop merged in PR #36 (task_059).
    attachSuppressed(error, await unwindErrors(stack));
    throw error;
  }
  return { fixtures, close: () => unwind(stack) };
}

/* -------------------------------------------------------------------------- */
/* Unwinding and error precedence (ADR 0025)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Runs every teardown on `stack` (LIFO) and returns the errors they raised, in
 * the order thrown. Never throws itself, so a caller with an error already in
 * flight can decide what to do with these instead of having them replace it.
 */
async function unwindErrors(
  stack: Array<() => Promise<void>>,
): Promise<unknown[]> {
  const errors: unknown[] = [];
  while (stack.length) {
    const td = stack.pop()!;
    try {
      await td();
    } catch (err) {
      errors.push(err);
    }
  }
  return errors;
}

/**
 * Attaches `errors` to `target` as an enumerable own `suppressed` property,
 * appending to a list that is already there rather than overwriting it — an
 * error can outlive more than one unwind.
 *
 * Enumerable on purpose: Bun prints an enumerable `suppressed` when it reports
 * a failing async test, so this is how a losing teardown error reaches a user
 * who never inspects the error object.
 *
 * A `target` that is not an object has nowhere to put the list, and wrapping it
 * would change what the user catches, so it is left alone. That is the one case
 * where teardown errors are still dropped, and ADR 0025 records it.
 */
function attachSuppressed(target: unknown, errors: unknown[]): void {
  if (!errors.length) return;
  if (typeof target !== "object" || target === null) return;
  const existing = (target as { suppressed?: unknown }).suppressed;
  Object.defineProperty(target, "suppressed", {
    value: Array.isArray(existing) ? [...existing, ...errors] : errors,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/**
 * The error to propagate when nothing else went wrong: the first error thrown,
 * carrying the rest as `suppressed`. Returns rather than throws so the call
 * site reads as `throw firstWithSuppressed(errors)`.
 */
function firstWithSuppressed(errors: unknown[]): unknown {
  const [first, ...rest] = errors;
  attachSuppressed(first, rest);
  return first;
}

/**
 * Runs `body`, then tears `stack` down, resolving with `body`'s result.
 *
 * ADR 0025 — the error that started the failure is the one thrown. If `body`
 * threw, that error propagates with every teardown error attached to it; if it
 * did not, the first teardown error propagates with the rest attached. A
 * `finally` block cannot express this: a throw from `finally` replaces the
 * error already in flight, which is the defect this exists to fix.
 */
async function runWithUnwind<T>(
  stack: Array<() => Promise<void>>,
  body: () => Promise<T>,
): Promise<T> {
  let result!: T;
  let failure: unknown;
  let threw = false;

  try {
    result = await body();
  } catch (error) {
    threw = true;
    failure = error;
  }

  const teardownErrors = await unwindErrors(stack);

  if (threw) {
    // `body` started the failure, so its error is the one a user needs.
    attachSuppressed(failure, teardownErrors);
    throw failure;
  }
  if (teardownErrors.length) throw firstWithSuppressed(teardownErrors);
  return result;
}

/** Tears `stack` down and throws the first error, carrying the rest. */
async function unwind(stack: Array<() => Promise<void>>): Promise<void> {
  const errors = await unwindErrors(stack);
  if (errors.length) throw firstWithSuppressed(errors);
}

/** Tears down every file-scoped fixture for `file` (LIFO). */
export async function teardownFile(file: string): Promise<void> {
  const fs = state.files.get(file);
  if (!fs) return;
  state.files.delete(file);
  fs.cache.clear();
  await unwind(fs.stack);
}

/** Tears down every file-scoped fixture of every file seen so far. */
export async function teardownAllFiles(): Promise<void> {
  for (const file of [...state.files.keys()].reverse())
    await teardownFile(file);
  state.currentFile = null;
}

/** Tears down every file- and session-scoped fixture (LIFO). */
export async function teardownSession(): Promise<void> {
  await teardownAllFiles();
  state.session.clear();
  await unwind(state.sessionStack);
}

function hookProcessExit() {
  if (state.exitHooked) return;
  state.exitHooked = true;
  let running = false;
  process.on("beforeExit", async () => {
    if (running || (state.sessionStack.length === 0 && state.files.size === 0))
      return;
    running = true;
    try {
      await teardownSession();
    } catch (err) {
      // ADR 0025: this path is silent by default, so the suppressed errors
      // have to ride along in the one line it prints — otherwise they vanish
      // with no trace at all.
      const message = (err as Error).message;
      const suppressed = (err as { suppressed?: unknown[] }).suppressed;
      const rest = Array.isArray(suppressed)
        ? suppressed.map((e) => (e as Error)?.message ?? String(e))
        : [];
      warn(
        `session teardown failed: ${message}${
          rest.length ? ` (suppressed: ${rest.join(", ")})` : ""
        }`,
        "SESSION_TEARDOWN",
        { cause: message },
      );
    } finally {
      running = false;
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

function makeTest(file: string, map: FixtureMap): TestFn {
  const abs = resolve(file);
  return (name, fn, opts?: TestOptions) => {
    const requested = opts?.fixtures ?? detectFixtures(fn, 0);
    const order = resolveOrder(requested, map, abs);
    const testName = name;

    const body = async () => {
      await enterFile(abs);
      const testStack: Array<() => Promise<void>> = [];
      const ctx: FixtureContext = { testFile: abs, testName };

      const buildAll = async (
        target: FixtureContext,
        stack: Array<() => Promise<void>>,
        names: string[],
      ) => {
        for (const fixture of names) {
          target[fixture] = await instantiate(fixture, map, target, abs, stack);
        }
      };

      // ADR 0025 — runWithUnwind, not `finally`: a teardown error must be
      // attached to the error in flight, never replace it.
      await runWithUnwind(testStack, async () => {
        if (opts?.iterate) {
          // Defer test-scope fixtures to ctx.iterate: the wrapper context
          // holds only session/file values, and each iterate() call builds
          // a fresh set of test-scope fixtures with LIFO unwind — the
          // per-sample lifecycle property runners need.
          ctx.iterate = (async <T>(
            fn2: (iterCtx: FixtureContext) => T | Promise<T>,
          ): Promise<T> => {
            const iterStack: Array<() => Promise<void>> = [];
            return runWithUnwind(iterStack, async () => {
              const iterCtx: FixtureContext = { testFile: abs, testName };
              await buildAll(iterCtx, iterStack, order);
              return await fn2(iterCtx);
            });
          }) satisfies IterateFn;
          await buildAll(
            ctx,
            testStack,
            order.filter((n) => scopeOf(map[n]!) !== "test"),
          );
        } else {
          await buildAll(ctx, testStack, order);
        }
        await fn(ctx);
      });
    };
    if (opts?.timeout === undefined) bunTest(testName, body);
    else bunTest(testName, body, opts.timeout);
  };
}

/**
 * Bun exposes no "end of test file" hook that survives being called from
 * inside a `describe` block, so file scope is closed when the *next* file
 * starts a test (Bun runs test files sequentially) and, for the last file,
 * at process exit.
 */
async function enterFile(file: string): Promise<void> {
  if (state.currentFile === file) return;
  const previous = state.currentFile;
  state.currentFile = file;
  if (previous) await teardownFile(previous);
  hookProcessExit();
}

/**
 * Declares a fixture with an inferred public type.
 *
 * Capability packages use this instead of depending on the `FixtureDef` type
 * directly. It is intentionally a small identity function: the engine still
 * owns validation, dependency ordering, scopes, and teardown.
 */
export function createFixture<T>(definition: FixtureDef<T>): FixtureDef<T> {
  return definition;
}

/**
 * Creates a fixture-aware `test` bound to a specific file.
 *
 * ```ts
 * const { test, expect } = createTest(import.meta.path);
 * const dbTest = test.extend({ db });
 * dbTest("uses db", async ({ db }) => { ... });
 * ```
 */
export function createTest(testFile?: string): {
  test: FixtureAwareTest;
  describe: typeof bunDescribe;
  expect: typeof bunExpect;
} {
  const file = resolve(testFile ?? callerFile());
  return {
    test: makeAwareTest({}, file),
    describe: bunDescribe,
    expect: bunExpect,
  };
}

/** Internal companion hook: bind an existing fixture map to a specific file without changing its cache identity. */
export function createTestWithFixtures(
  testFile: string,
  fixtures: FixtureMap,
): FixtureAwareTest {
  return makeAwareTest(fixtures, resolve(testFile), false);
}

export async function executeScenarioSteps(
  steps: Array<{
    phase: "given" | "when" | "then";
    fn: (ctx: ScenarioContext<any>) => any;
  }>,
  context: ScenarioContext<any>,
): Promise<void> {
  for (const step of steps) {
    const result = await step.fn(context);
    if (step.phase !== "then" && result && typeof result === "object") {
      Object.assign(context, result);
    }
  }
}

function scenarioFactory(file: string, map: FixtureMap): ScenarioFactory {
  const create = <S extends object = Record<string, unknown>>(
    title: string,
  ): ScenarioChain<S> => {
    const steps: Array<{
      phase: "given" | "when" | "then";
      name: string;
      fn: (ctx: ScenarioContext<any>) => any;
    }> = [];
    let registered = false;

    const chain = {
      given(name: string, fn: (ctx: ScenarioContext<any>) => any) {
        if (steps.some((step) => step.phase !== "given"))
          throw new Error(
            "[bun-test-utils] scenario given() must precede when() and then()",
          );
        steps.push({ phase: "given", name, fn });
        return chain;
      },
      when(name: string, fn: (ctx: ScenarioContext<any>) => any) {
        if (steps.some((step) => step.phase === "then"))
          throw new Error(
            "[bun-test-utils] scenario when() must precede then()",
          );
        steps.push({ phase: "when", name, fn });
        return chain;
      },
      // biome-ignore lint/suspicious/noThenProperty: `then` is the intentional fluent scenario phase.
      then(name: string, fn: (ctx: ScenarioContext<any>) => any) {
        steps.push({ phase: "then", name, fn });
        if (!registered) {
          registered = true;
          makeTest(file, map)(
            title,
            async (fixtures) => {
              const context = Object.assign(fixtures, { expect: bunExpect });
              await executeScenarioSteps(steps, context);
            },
            {
              fixtures: [
                ...new Set(
                  steps
                    .flatMap((step) => detectFixtures(step.fn, 0))
                    .filter((name) => name in map),
                ),
              ],
            },
          );
        }
        return chain;
      },
    } as ScenarioChain<S>;
    return chain;
  };

  const factory = create as ScenarioFactory;
  factory.prop = (title, _strategies) => {
    throw new Error(
      `[bun-test-utils] scenario.prop(${title}) requires the property-test integration; use test.prop() for property tests`,
    );
  };
  return factory;
}

function makeAwareTest(
  fixtures: FixtureMap = {},
  fixedFile?: string,
  cloneFixtures = true,
): FixtureAwareTest {
  const map = cloneFixtures ? { ...fixtures } : fixtures;
  const resolveFile = () => resolve(fixedFile ?? callerFile());
  const aware = ((name: string, fn: any, opts?: TestOptions) => {
    return makeTest(resolveFile(), map)(name, fn, opts);
  }) as FixtureAwareTest;
  aware.extend = (more) => makeAwareTest({ ...map, ...more }, fixedFile);
  aware.scenario = ((title: string) =>
    scenarioFactory(resolveFile(), map)(title)) as ScenarioFactory;
  aware.scenario.prop = (title, strategies) =>
    scenarioFactory(resolveFile(), map).prop(title, strategies);
  Object.defineProperty(aware, FIXTURE_MAP_SYMBOL, {
    value: map,
    enumerable: false,
  });
  return aware;
}

/** Top-level `test()` — detects the calling file from the stack trace. */
export const test: FixtureAwareTest = makeAwareTest();

export const describe = bunDescribe;
export const expect = bunExpect;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const SELF = import.meta.path ?? "";
/** Both the resolved and the symlinked path of this module (npm link, bunx, …). */
const SELF_PATHS = new Set(
  [
    SELF,
    (() => {
      try {
        return realpathSync(SELF);
      } catch {
        return SELF;
      }
    })(),
  ].filter(Boolean),
);

/**
 * Detects the nearest caller file outside this module (and outside
 * `extraSelf`, when given) from the stack trace.
 *
 * Exported for internal companion runners: their
 * wrappers (`test.prop`, `createPropTest`) sit between the test file and the
 * engine, so they detect their caller with `callerFile(ownIndexPath)` and
 * bind a per-file runner of their own — mirroring the top-level `test`.
 */
export function callerFile(extraSelf?: string | string[]): string {
  const skip =
    extraSelf === undefined
      ? SELF_PATHS
      : new Set([
          ...SELF_PATHS,
          ...(Array.isArray(extraSelf) ? extraSelf : [extraSelf]),
        ]);
  const stack = new Error().stack ?? "";
  const re = /((?:\/|[A-Za-z]:\\)[^\s()]+?\.(?:[cm]?[tj]sx?)):\d+(?::\d+)?/g;
  const installedPackage = `${sep}node_modules${sep}@archont561${sep}bun-test-utils${sep}`;
  for (const match of stack.matchAll(re)) {
    const file = match[1]!;
    if (skip.has(file)) continue;
    if (file.includes(installedPackage)) continue;
    if (file.startsWith("bun:") || file.includes("node:internal")) continue;
    return file;
  }
  return SELF;
}

function rel(p: string): string {
  const r = relative(process.cwd(), p);
  return r.startsWith("..") ? p : r || p;
}

/**
 * Installs an optional diagnostics sink and returns a restore function.
 * The engine is silent unless a sink is installed or debug mode is enabled.
 */
export function configureDiagnostics(sink?: DiagnosticsSink): () => void {
  const previous = state.diagnostics;
  state.diagnostics = sink;
  return () => {
    state.diagnostics = previous;
  };
}

/** Emits a structured diagnostic for integrations that wrap the engine. */
export function reportDiagnostic(event: DiagnosticEvent): void {
  if (state.diagnostics) {
    state.diagnostics(event);
    return;
  }
  if (process.env.BUN_TEST_UTILS_DEBUG === "1") {
    process.stderr.write(
      `[bun-test-utils] ${event.code}: ${event.message}${event.details ? ` ${JSON.stringify(event.details)}` : ""}\n`,
    );
  }
}

function warn(
  message: string,
  code: DiagnosticEvent["code"] = "FIXTURE_COMPOSITION",
  details?: Record<string, unknown>,
): void {
  reportDiagnostic({ code, message, details });
}

/* -------------------------------------------------------------------------- */
/* Preload entry                                                               */
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

/** A URL matcher shared by fetch-intercepting fixtures. */
export type FetchMatcher = string | RegExp | ((request: Request) => boolean);

/** Matches an intercepted request without consuming its body. */
export function matchesFetch(matcher: FetchMatcher, request: Request): boolean {
  if (typeof matcher === "function") return matcher(request.clone());
  if (matcher instanceof RegExp) {
    matcher.lastIndex = 0;
    return matcher.test(request.url);
  }
  const url = new URL(request.url);
  if (/^https?:\/\//.test(matcher) || matcher.startsWith("data:")) {
    return request.url === matcher;
  }
  return url.pathname === matcher || request.url.endsWith(matcher);
}

/** Installs one global fetch interceptor and returns its idempotent teardown. */
export function installFetchInterceptor(
  intercept: (
    request: Request,
  ) => Response | undefined | Promise<Response | undefined>,
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await intercept(new Request(input, init));
    return response ?? originalFetch(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

/** Creates a stable, filesystem-safe filename component. */
export function slugifyFilename(name: string, fallback: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || fallback
  );
}

export default { createTest, test, expect };

/**
 * bun-test-utils — preload plugin + fixture engine + public API.
 *
 * This single module is both:
 *   1. the preload script (`bunfig.toml` → `[test].preload`), which walks the
 *      project tree and builds the directory → fixtures map, and
 *   2. the package entrypoint (`import { test, expect } from "bun-test-utils"`).
 *
 * Loading it twice is harmless: all state lives on a global singleton.
 */

import {
  afterAll as bunAfterAll,
  describe as bunDescribe,
  expect as bunExpect,
  test as bunTest,
} from "bun:test";
import { type Dirent, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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

export type {
  BunTestUtilsErrorCode,
  DiagnosticEvent,
  DiagnosticsSink,
  FixtureAwareTest,
  FixtureContext,
  FixtureDef,
  FixtureMap,
  GivenChain,
  IterateFn,
  ScenarioChain,
  ScenarioContext,
  ScenarioFactory,
  Scope,
  TestFn,
  TestOptions,
  UseFn,
  WhenChain,
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
  root: string;
  /** absolute dir → fixtures declared in that dir */
  dirMap: Map<string, FixtureMap>;
  /** memoised merged map per test file */
  mergedCache: Map<string, FixtureMap>;
  discovered: boolean;
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
  diagnostics?: DiagnosticsSink;
}

/** Context keys that are metadata, not fixtures — ignored during auto-detection. */
const META_KEYS = new Set([
  "testFile",
  "testName",
  "param",
  "scope",
  "iterate",
]);

const SCOPE_RANK: Record<Scope, number> = { session: 0, file: 1, test: 2 };
const FIXTURE_FILENAMES = [
  "fixtures.ts",
  "fixtures.tsx",
  "conftest.ts",
  "conftest.tsx",
];
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".bun",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".cache",
  "vendor",
  "__pycache__",
]);

const g = globalThis as any;

const state: State = (g.__BUN_TEST_UTILS__ ??= {
  root: resolve(process.env.BUN_TEST_UTILS_ROOT ?? process.cwd()),
  dirMap: new Map(),
  mergedCache: new Map(),
  discovered: false,
  session: new Map(),
  sessionStack: [],
  files: new Map(),
  currentFile: null,
  exitHooked: false,
  afterAllHooked: false,
  defIds: new WeakMap(),
  nextDefId: 1,
} satisfies State);

/* -------------------------------------------------------------------------- */
/* Discovery                                                                  */
/* -------------------------------------------------------------------------- */

function collectFixtureFiles(dir: string, acc: string[], depth = 0): string[] {
  if (depth > 24) return acc;
  let entries: Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        SKIP_DIRS.has(entry.name) ||
        (entry.name.startsWith(".") && entry.name !== ".")
      )
        continue;
      collectFixtureFiles(full, acc, depth + 1);
    } else if (FIXTURE_FILENAMES.includes(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Walks the project tree, imports every `fixtures.ts` / `conftest.ts` and
 * records its default export against the directory it lives in.
 *
 * Idempotent — safe to call from both the preload and a plain import.
 */
/** @internal Test-only compatibility hook; consumers should use test.extend(). */
export async function discoverFixtures(
  root: string = state.root,
): Promise<Map<string, FixtureMap>> {
  if (state.discovered) return state.dirMap;
  state.discovered = true;
  state.root = resolve(root);

  let dirExists = false;
  try {
    dirExists = statSync(state.root).isDirectory();
  } catch {
    dirExists = false;
  }
  if (!dirExists) return state.dirMap;

  const files = collectFixtureFiles(state.root, []).sort(
    (a, b) => a.split(sep).length - b.split(sep).length || a.localeCompare(b),
  );

  for (const file of files) {
    try {
      const mod = await import(file);
      const map: FixtureMap | undefined = mod.default ?? mod.fixtures;
      if (!map || typeof map !== "object") {
        warn(
          `${rel(file)} has no default export of fixtures — skipped.`,
          "FIXTURE_DISCOVERY",
          { file },
        );
        continue;
      }
      const dir = dirname(file);
      state.dirMap.set(dir, { ...(state.dirMap.get(dir) ?? {}), ...map });
    } catch (err) {
      warn(
        `failed to load ${rel(file)}: ${(err as Error).message}`,
        "FIXTURE_DISCOVERY",
        { file, cause: (err as Error).message },
      );
    }
  }
  state.mergedCache.clear();
  return state.dirMap;
}

/** Registers fixtures programmatically for a directory (useful in tests / tooling). */
export function registerFixtures(dir: string, map: FixtureMap): void {
  const abs = resolve(dir);
  state.dirMap.set(abs, { ...(state.dirMap.get(abs) ?? {}), ...map });
  state.mergedCache.clear();
}

/**
 * Merges every fixture map from the project root down to the directory of
 * `testFile`. Deeper directories win (last-wins merge), emulating conftest.py.
 */
export function fixturesFor(testFile: string): FixtureMap {
  const abs = resolve(testFile);
  const cached = state.mergedCache.get(abs);
  if (cached) return cached;

  const dir = dirname(abs);
  const chain: string[] = [];
  const relPath = relative(state.root, dir);
  if (!relPath.startsWith("..") && !isAbsolute(relPath)) {
    let current = state.root;
    chain.push(current);
    for (const part of relPath.split(sep).filter(Boolean)) {
      current = join(current, part);
      chain.push(current);
    }
  } else {
    // Test file outside the discovered root: only its own directory applies.
    chain.push(dir);
  }

  const merged: FixtureMap = {};
  for (const d of chain) Object.assign(merged, state.dirMap.get(d) ?? {});
  state.mergedCache.set(abs, merged);
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Dependency / parameter planning                                            */
/* -------------------------------------------------------------------------- */

/**
 * Auto-detection of the fixtures a function requests from its destructured
 * parameter, metadata keys excluded. Exported for companion runners
 * (e.g. @bun-test-utils/pbt) whose own callback signatures wrap the
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
      const known = Object.keys(map).sort().join(", ") || "<none>";
      throw new UnknownFixtureError(
        name,
        Object.keys(map).sort(),
        where,
        `[bun-test-utils] unknown fixture "${name}" requested in ${rel(where)}. Available: ${known}`,
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

/** Cartesian product of every parameterized fixture in `order`. */
export function paramCombos(
  order: string[],
  map: FixtureMap,
): Array<Record<string, number>> {
  const parameterized = order.filter(
    (n) => Array.isArray(map[n]!.params) && map[n]!.params!.length > 0,
  );
  let combos: Array<Record<string, number>> = [{}];
  for (const name of parameterized) {
    const next: Array<Record<string, number>> = [];
    for (const combo of combos) {
      for (let i = 0; i < map[name]!.params!.length; i++) {
        next.push({ ...combo, [name]: i });
      }
    }
    combos = next;
  }
  return combos;
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
  paramIndex: number | undefined,
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
    param: paramIndex === undefined ? undefined : def.params![paramIndex],
  });

  let finished = false;
  const run = Promise.resolve()
    .then(() => def.setup(use, fixtureCtx))
    .then(
      () => {
        finished = true;
        if (!delivered) deliver();
      },
      (err) => {
        finished = true;
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
      if (!finished) await run;
      else await run;
    },
  };
}

async function instantiate(
  name: string,
  map: FixtureMap,
  ctx: FixtureContext,
  file: string,
  combo: Record<string, number>,
  testStack: Array<() => Promise<void>>,
): Promise<any> {
  const def = map[name]!;
  const scope = scopeOf(def);
  const paramIndex = name in combo ? combo[name] : undefined;
  const key = `${name}#${defId(def)}${paramIndex === undefined ? "" : `[${paramIndex}]`}`;

  if (scope === "session") {
    const hit = state.session.get(key);
    if (hit) return hit.value;
    const inst = await build(name, def, ctx, paramIndex);
    state.session.set(key, inst);
    state.sessionStack.push(inst.teardown);
    hookProcessExit();
    return inst.value;
  }

  if (scope === "file") {
    const fs = fileState(file);
    const hit = fs.cache.get(key);
    if (hit) return hit.value;
    const inst = await build(name, def, ctx, paramIndex);
    fs.cache.set(key, inst);
    fs.stack.push(inst.teardown);
    return inst.value;
  }

  const inst = await build(name, def, ctx, paramIndex);
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
  for (const name of order) {
    fixtures[name] = await instantiate(name, map, fixtures, file, {}, stack);
  }
  return { fixtures, close: () => unwind(stack) };
}

export async function withFixtures<T>(
  map: FixtureMap,
  names: string[],
  context: Partial<FixtureContext> = {},
  body: (fixtures: FixtureContext) => T | Promise<T>,
): Promise<T> {
  const scope = await openFixtures(map, names, context);
  try {
    return await body(scope.fixtures);
  } finally {
    await scope.close();
  }
}

async function unwind(stack: Array<() => Promise<void>>): Promise<void> {
  const errors: unknown[] = [];
  while (stack.length) {
    const td = stack.pop()!;
    try {
      await td();
    } catch (err) {
      errors.push(err);
    }
  }
  if (errors.length) throw errors[0];
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
      warn(
        `session teardown failed: ${(err as Error).message}`,
        "SESSION_TEARDOWN",
        { cause: (err as Error).message },
      );
    } finally {
      running = false;
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

function label(
  name: string,
  combo: Record<string, number>,
  map: FixtureMap,
): string {
  const keys = Object.keys(combo);
  if (keys.length === 0) return name;
  const parts = keys.map((k) => `${k}=${format(map[k]!.params![combo[k]!])}`);
  return `${name} [${parts.join(", ")}]`;
}

function format(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function makeTest(file: string): TestFn {
  const abs = resolve(file);
  return (name, fn, opts?: TestOptions) => {
    const map = fixturesFor(abs);
    const requested = opts?.fixtures ?? detectFixtures(fn, 0);
    const order = resolveOrder(requested, map, abs);
    const combos = paramCombos(order, map);

    for (const combo of combos) {
      const testName = label(name, combo, map);
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
            target[fixture] = await instantiate(
              fixture,
              map,
              target,
              abs,
              combo,
              stack,
            );
          }
        };

        try {
          if (opts?.iterate) {
            // Defer test-scope fixtures to ctx.iterate: the wrapper context
            // holds only session/file values, and each iterate() call builds
            // a fresh set of test-scope fixtures with LIFO unwind — the
            // per-sample lifecycle property runners need.
            ctx.iterate = (async <T>(
              fn2: (iterCtx: FixtureContext) => T | Promise<T>,
            ): Promise<T> => {
              const iterStack: Array<() => Promise<void>> = [];
              const iterCtx: FixtureContext = {
                testFile: abs,
                testName,
              };
              try {
                await buildAll(iterCtx, iterStack, order);
                return await fn2(iterCtx);
              } finally {
                await unwind(iterStack);
              }
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
        } finally {
          await unwind(testStack);
        }
      };
      if (opts?.timeout === undefined) bunTest(testName, body);
      else bunTest(testName, body, opts.timeout);
    }
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
 * Creates a fixture-aware `test` bound to a specific file.
 *
 * ```ts
 * const { test, expect } = createTest(import.meta.path);
 * test("uses db", async ({ db }) => { ... });
 * ```
 */
export function createTest(testFile?: string): {
  test: TestFn;
  describe: typeof bunDescribe;
  expect: typeof bunExpect;
} {
  const file = resolve(testFile ?? callerFile());
  return { test: makeTest(file), describe: bunDescribe, expect: bunExpect };
}

const testCache = new Map<string, TestFn>();

function runnerFor(file: string): TestFn {
  let runner = testCache.get(file);
  if (!runner) {
    runner = makeTest(file);
    testCache.set(file, runner);
  }
  return runner;
}

function scenarioFactory(file: string): ScenarioFactory {
  const create = <S extends object = Record<string, unknown>>(
    title: string,
  ): ScenarioChain<S> => {
    const steps: Array<{
      phase: "given" | "when" | "then";
      name: string;
      fn: (ctx: ScenarioContext<any>) => any;
    }> = [];

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
        runnerFor(file)(
          title,
          async (fixtures) => {
            const context = Object.assign(fixtures, { expect: bunExpect });
            for (const step of steps) {
              const result = await step.fn(context);
              if (step.phase !== "then" && result && typeof result === "object")
                Object.assign(context, result);
            }
          },
          {
            fixtures: [
              ...new Set(
                steps
                  .flatMap((step) => detectFixtures(step.fn, 0))
                  .filter((name) => name in fixturesFor(file)),
              ),
            ],
          },
        );
      },
    } as ScenarioChain<S>;
    return chain;
  };

  const factory = create as ScenarioFactory;
  factory.prop = (title, _strategies) => {
    throw new Error(
      `[bun-test-utils] scenario.prop(${title}) requires the bun-test-utils/pbt integration; use test.prop() for property tests`,
    );
  };
  return factory;
}

function makeAwareTest(fixtures?: FixtureMap): FixtureAwareTest {
  if (fixtures) registerFixtures(dirname(callerFile()), fixtures);
  const aware = ((name: string, fn: any, opts?: TestOptions) => {
    const file = callerFile();
    if (fixtures) registerFixtures(dirname(file), fixtures);
    return runnerFor(file)(name, fn, opts);
  }) as FixtureAwareTest;
  aware.extend = (more) => makeAwareTest({ ...(fixtures ?? {}), ...more });
  aware.scenario = ((title: string) =>
    scenarioFactory(callerFile())(title)) as ScenarioFactory;
  aware.scenario.prop = (title, strategies) =>
    scenarioFactory(callerFile()).prop(title, strategies);
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
 * Exported for companion runners such as @bun-test-utils/pbt: their
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
  for (const match of stack.matchAll(re)) {
    const file = match[1]!;
    if (skip.has(file)) continue;
    if (file.includes(`${sep}node_modules${sep}bun-test-utils${sep}`)) continue;
    if (file.startsWith("bun:") || file.includes("node:internal")) continue;
    return file;
  }
  return SELF;
}

function rel(p: string): string {
  const r = relative(state.root, p);
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
  code: DiagnosticEvent["code"] = "FIXTURE_DISCOVERY",
  details?: Record<string, unknown>,
): void {
  reportDiagnostic({ code, message, details });
}

/* -------------------------------------------------------------------------- */
/* Preload entry                                                               */
/* -------------------------------------------------------------------------- */

// Fixture registration is explicit: consumers compose fixtures with
// `test.extend()`. The test-only legacy bootstrap calls discoverFixtures()
// directly for the engine's historical conformance fixtures; it is not part
// of the published preload path.
if (process.env.BUN_TEST_UTILS_LEGACY_DISCOVERY === "1") {
  await discoverFixtures();
}

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
 * global singleton — so a test file importing `"bun-test-utils"` would hook a
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

export default { fixturesFor, createTest, test, expect };

/**
 * Fixture lifecycle (split out of plugin.ts — audit 2026-10-06, finding 3):
 * building fixture instances, scope caches, LIFO unwinding with the ADR 0025
 * error precedence, and the process/file teardown entrypoints.
 */

import { FixtureLifecycleError } from "./errors.ts";
import { resolveOrder, scopeOf } from "./graph.ts";
import { callerFile, warn } from "./helpers.ts";
import type { Instance } from "./state.ts";
import { defId, mapId, state } from "./state.ts";
import type { FixtureContext, FixtureDef, FixtureMap } from "./types.ts";

export function fileState(file: string) {
  let fs = state.files.get(file);
  if (!fs) {
    fs = { cache: new Map(), stack: [] };
    state.files.set(file, fs);
  }
  return fs;
}

export async function build(
  name: string,
  def: FixtureDef,
  ctx: FixtureContext,
): Promise<Instance> {
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));

  let delivered = false;
  let value: unknown;
  let deliver!: () => void;
  const gotValue = new Promise<void>((r) => (deliver = r));

  const use = (v: unknown): Promise<void> => {
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

export async function instantiate(
  name: string,
  map: FixtureMap,
  ctx: FixtureContext,
  file: string,
  testStack: Array<() => Promise<void>>,
): Promise<unknown> {
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

/**
 * Runs every teardown on `stack` (LIFO) and returns the errors they raised, in
 * the order thrown. Never throws itself, so a caller with an error already in
 * flight can decide what to do with these instead of having them replace it.
 */
export async function unwindErrors(
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
export function attachSuppressed(target: unknown, errors: unknown[]): void {
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
export function firstWithSuppressed(errors: unknown[]): unknown {
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
export async function runWithUnwind<T>(
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
export async function unwind(stack: Array<() => Promise<void>>): Promise<void> {
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

export function hookProcessExit() {
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

/**
 * Bun exposes no "end of test file" hook that survives being called from
 * inside a `describe` block, so file scope is closed when the *next* file
 * starts a test (Bun runs test files sequentially) and, for the last file,
 * at process exit.
 */
export async function enterFile(file: string): Promise<void> {
  if (state.currentFile === file) return;
  const previous = state.currentFile;
  state.currentFile = file;
  if (previous) await teardownFile(previous);
  hookProcessExit();
}

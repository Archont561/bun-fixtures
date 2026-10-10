/**
 * Global engine state (split out of plugin.ts — audit 2026-10-06, finding 3).
 *
 * All lifecycle state lives on a `globalThis` singleton so the preload copy
 * and every bundled copy of the engine share one instance; loading the engine
 * twice is harmless. See the facade (plugin.ts) for the preload wiring.
 */

import type {
  DiagnosticsSink,
  FixtureDef,
  FixtureMap,
  Scope,
} from "./types.ts";

export interface Instance {
  /** The delivered fixture value — `unknown`: fixture types are the user's. */
  value: unknown;
  /** Resolves the `use()` promise and waits for the setup function to finish. */
  teardown: () => Promise<void>;
}

export interface State {
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
export const META_KEYS = new Set([
  "testFile",
  "testName",
  "param",
  "scope",
  "iterate",
]);

export const SCOPE_RANK: Record<Scope, number> = {
  session: 0,
  file: 1,
  test: 2,
};

/**
 * Tags a fixture-aware test with its fixture map. `Symbol.for`, so companion
 * runners (pbt, bdd) can read the tag without importing this module.
 */
export const FIXTURE_MAP_SYMBOL = Symbol.for("bun-test-utils.fixtureMap");

/**
 * The engine keeps all lifecycle state on a global singleton so the preload
 * copy and every bundled copy share one instance. This carrier names the one
 * property this module touches on `globalThis` — the narrow interface instead
 * of an `any` cast at the global boundary (audit finding 2).
 */
interface GlobalStateCarrier {
  __BUN_TEST_UTILS__?: State;
}

const g = globalThis as GlobalStateCarrier;

export const state: State = (g.__BUN_TEST_UTILS__ ??= {
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

/** Stable per-definition identity for fixture cache keys. */
export function defId(def: FixtureDef): number {
  let id = state.defIds.get(def);
  if (!id) {
    id = state.nextDefId++;
    state.defIds.set(def, id);
  }
  return id;
}

/** Stable per-map identity for fixture cache keys. */
export function mapId(map: FixtureMap): number {
  let id = state.mapIds.get(map);
  if (!id) {
    id = state.nextMapId++;
    state.mapIds.set(map, id);
  }
  return id;
}

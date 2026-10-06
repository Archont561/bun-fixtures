import {
  type FixtureContext,
  type FixtureMap,
  openFixtures,
} from "@bun-test-utils/core";

export interface BddWorld {
  [key: string]: any;
}

export interface BddHooks {
  Before(fn: (world: BddWorld) => void | Promise<void>): void;
  After(fn: (world: BddWorld) => void | Promise<void>): void;
}

export function fixtureSteps(
  hooks: BddHooks,
  fixtures: FixtureMap,
  names: string[],
): void {
  const scopes = new WeakMap<object, { close: () => Promise<void> }>();
  hooks.Before(async (world) => {
    const scope = await openFixtures(fixtures, names);
    Object.assign(world, scope.fixtures);
    scopes.set(world, scope);
  });
  hooks.After(async (world) => {
    const scope = scopes.get(world);
    if (scope) {
      await scope.close();
      scopes.delete(world);
    }
  });
}

/** Public error surface, mirrored from core so subpath consumers can type catches. */
export { BunTestUtilsError } from "@bun-test-utils/core";
export type { FixtureContext, FixtureMap };
export { openFixtures };

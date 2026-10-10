/**
 * Dependency graph resolution (split out of plugin.ts — audit 2026-10-06,
 * finding 3): dependency inference, scope rules and topological ordering with
 * the contractual error messages.
 */

import { destructuredKeys } from "./detect.ts";
import {
  FixtureDependencyError,
  FixtureScopeError,
  UnknownFixtureError,
} from "./errors.ts";
import { rel } from "./helpers.ts";
import { META_KEYS, SCOPE_RANK } from "./state.ts";
import type { FixtureDef, FixtureMap, Scope } from "./types.ts";

export function depsOf(def: FixtureDef): string[] {
  if (def.deps) return def.deps;
  return destructuredKeys(def.setup, 1).filter((n) => !META_KEYS.has(n));
}

export function scopeOf(def: FixtureDef): Scope {
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

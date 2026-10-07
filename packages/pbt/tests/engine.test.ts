/**
 * Engine combinatorics, property-tested from pbt rather than core.
 *
 * `paramCombos` and `resolveOrder` are the functions that decide cartesian
 * expansion and setup order (and therefore LIFO teardown). Hosting the
 * properties here keeps `@bun-test-utils/core` free of a pbt devDependency
 * and the turbo graph acyclic. Runtime LIFO of the iterate protocol is the
 * per-iteration suite in `index.test.ts`.
 */
import {
  type FixtureMap,
  paramCombos,
  resolveOrder,
} from "@bun-test-utils/core";
import fc from "fast-check";
import { describe, expect, test } from "@/index.ts";

const NAMES = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
] as const;

function stub(params?: unknown[]): FixtureMap[string] {
  return {
    setup: async (use) => {
      await use(null);
    },
    ...(params ? { params } : {}),
  };
}

describe("engine combinatorics", () => {
  test.prop(
    "paramCombos is the cartesian product of parameterized fixtures",
    {
      names: fc.uniqueArray(fc.constantFrom(...NAMES), {
        minLength: 1,
        maxLength: 3,
      }),
      lengths: fc.array(fc.integer({ min: 0, max: 3 }), {
        minLength: 1,
        maxLength: 3,
      }),
    },
    async (_ctx, { names, lengths }) => {
      const map: FixtureMap = {};
      let product = 1;
      for (let i = 0; i < names.length; i++) {
        const n = names[i]!;
        const len = lengths[i % lengths.length]!;
        const params =
          len === 0 ? undefined : Array.from({ length: len }, (_, j) => j);
        map[n] = stub(params);
        if (len > 0) product *= len;
      }
      const order = names;
      const combos = paramCombos(order, map);
      expect(combos).toHaveLength(product);
      const keys = combos.map((combo) => JSON.stringify(combo));
      expect(new Set(keys).size).toBe(combos.length);
      for (const combo of combos) {
        for (const name of order) {
          const params = map[name]!.params;
          if (!Array.isArray(params) || params.length === 0) {
            expect(name in combo).toBe(false);
            continue;
          }
          const index = combo[name];
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(params.length);
        }
      }
    },
    { numRuns: 40, seed: 20261007 },
  );

  test.prop(
    "resolveOrder is a topological order of an acyclic fixture graph",
    {
      names: fc.uniqueArray(fc.constantFrom(...NAMES), {
        minLength: 2,
        maxLength: 6,
      }),
      bits: fc.array(fc.boolean(), { minLength: 32, maxLength: 32 }),
      requestBits: fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
    },
    async (_ctx, { names, bits, requestBits }) => {
      const deps = new Map<string, string[]>();
      const map: FixtureMap = {};
      names.forEach((name, i) => {
        const chosen =
          i === 0
            ? []
            : names
                .slice(0, i)
                .filter((_, j) => bits[(i * 5 + j) % bits.length]!);
        deps.set(name, chosen);
        map[name] = {
          setup: async (use) => {
            await use(name);
          },
          deps: chosen,
        };
      });
      const requested = names.filter(
        (_, i) => requestBits[i % requestBits.length],
      );
      const targets =
        requested.length > 0 ? requested : [names[names.length - 1]!];

      const order = resolveOrder(targets, map, import.meta.path);

      const needed = new Set<string>();
      const walk = (n: string) => {
        if (needed.has(n)) return;
        needed.add(n);
        for (const d of deps.get(n) ?? []) walk(d);
      };
      for (const t of targets) walk(t);
      expect(new Set(order)).toEqual(needed);
      expect(order).toHaveLength(needed.size);

      const index = new Map(order.map((n, i) => [n, i]));
      for (const n of order) {
        for (const d of deps.get(n) ?? []) {
          expect(index.get(d)!).toBeLessThan(index.get(n)!);
        }
      }
    },
    { numRuns: 40, seed: 20261007 },
  );

  test(
    "failing properties surface the fast-check seed",
    async (ctx) => {
      const iterate = ctx.iterate!;
      let message = "";
      try {
        await fc.assert(
          fc.asyncProperty(fc.integer({ min: 0, max: 50 }), async (n) => {
            await iterate(async () => {
              if (n >= 0) throw new Error(`counterexample ${n}`);
            });
          }),
          { numRuns: 10, seed: 20261007 },
        );
      } catch (caught) {
        message = String(caught);
      }
      expect(message.length).toBeGreaterThan(0);
      expect(message.toLowerCase()).toContain("seed");
      expect(message).toContain("20261007");
    },
    { iterate: true },
  );
});

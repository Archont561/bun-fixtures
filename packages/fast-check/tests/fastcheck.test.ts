import { describe, expect, fc, test } from "../src/index.ts";

describe("@bun-fixture/fast-check", () => {
  test.prop(
    "reverses string twice to get original value",
    {
      s: fc.string(),
    },
    async (_ctx, { s }) => {
      const reversedTwice = s.split("").reverse().reverse().join("");
      expect(reversedTwice).toBe(s);
    },
    { numRuns: 50 },
  );

  test.prop(
    "addition is commutative with generated numbers",
    {
      a: fc.integer(),
      b: fc.integer(),
    },
    async (_ctx, { a, b }) => {
      expect(a + b).toBe(b + a);
    },
    { numRuns: 50 },
  );
});

// Lifecycle breadcrumbs: prop samples run inside one wrapper test, so the
// assertions about iteration behaviour land in later tests of this file.
const seenBoxes: number[] = [];
const seenCaches = new Set<object>();

describe("per-iteration fixture lifecycle", () => {
  test.prop(
    "gives every iteration a fresh test-scope fixture",
    { n: fc.integer() },
    async ({ box, fileCache }, { n: _n }) => {
      seenBoxes.push(box.id);
      seenCaches.add(fileCache);
      expect(box.id).toBeGreaterThan(0);
    },
    { numRuns: 8 },
  );

  test("…while session and file fixtures are preserved across iterations", async ({
    lifecycle,
  }) => {
    expect(new Set(seenBoxes).size).toBe(8);
    expect(seenCaches.size).toBe(1);
    // Every iteration built its box and tore it down before the next
    // sample ran — strict setup/teardown alternation.
    const boxEvents = lifecycle.filter((e: string) =>
      e.startsWith("box:"),
    ) as string[];
    expect(boxEvents).toHaveLength(16);
    boxEvents.forEach((event, i) => {
      expect(event.startsWith(i % 2 === 0 ? "box:setup" : "box:teardown")).toBe(
        true,
      );
    });
  });

  test(
    "runs full fixture teardown on every shrink step without leaking state",
    async (ctx) => {
      const iterate = ctx.iterate!;
      const lifecycle = ctx.lifecycle as string[];
      const before = lifecycle.length;

      const property = fc.asyncProperty(
        fc.integer({ min: 0, max: 50 }),
        async (v) => {
          await iterate(async () => {
            if (v >= 3) throw new Error(`counterexample ${v}`);
          });
        },
      );
      let failed = false;
      try {
        await fc.assert(property, { numRuns: 30, seed: 7 });
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);

      const slice = lifecycle.slice(before).filter((e) => e.startsWith("box:"));
      const setups = slice.filter((e) => e.startsWith("box:setup"));
      const teardowns = slice.filter((e) => e.startsWith("box:teardown"));
      // Failed sample plus at least one shrink confirmation…
      expect(setups.length).toBeGreaterThanOrEqual(2);
      // …each fully torn down — nothing leaks across shrink cycles.
      expect(setups.length).toBe(teardowns.length);
    },
    { fixtures: ["lifecycle", "box"], iterate: true },
  );

  test(
    "wrapper contexts hold eager session/file values only",
    async (ctx) => {
      expect(Array.isArray(ctx.lifecycle)).toBe(true);
      expect(typeof ctx.fileCache.marker).toBe("number");
      expect("box" in ctx).toBe(false);
    },
    { fixtures: ["lifecycle", "fileCache", "box"], iterate: true },
  );
});

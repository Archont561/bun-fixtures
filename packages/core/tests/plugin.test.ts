import {
  createTest,
  describe,
  destructuredKeys,
  expect,
  fixturesFor,
  paramCombos,
  resolveOrder,
  test,
} from "@/plugin.ts";

const here = import.meta.path;

describe("injection", () => {
  test("injects a session fixture", async ({ config }) => {
    expect(config.name).toBe("bun-test-utils");
  });

  test("sees the fixtures.ts of its own directory", async ({ origin }) => {
    expect(origin).toBe("tests");
  });

  test("resolves dependencies by name", async ({ client }) => {
    expect(client.connected).toBe(true);
    expect(client.tmp).toHaveProperty("n");
  });

  test(
    "supports an explicit fixture list",
    async (ctx) => {
      expect(ctx.answer).toBe(42);
    },
    { fixtures: ["answer"] },
  );

  test("exposes test metadata on the context", async ({
    testFile,
    testName,
  }) => {
    expect(testFile).toBe(here);
    expect(testName).toContain("metadata");
  });
});

describe("scopes", () => {
  let firstDbId: number | undefined;

  test("file-scoped fixtures are created once per file", async ({ db }) => {
    firstDbId = db.id;
    db.rows.push("a");
    expect(db.rows).toEqual(["a"]);
  });

  test("...and shared with the next test in the same file", async ({ db }) => {
    expect(db.id).toBe(firstDbId!);
    expect(db.rows).toEqual(["a"]);
  });

  test("test-scoped fixtures are rebuilt every test", async ({
    tmp,
    events,
  }) => {
    expect(
      events.filter((e: string) => e === "tmp:setup").length,
    ).toBeGreaterThan(1);
    expect(tmp.n).toBeGreaterThanOrEqual(0);
  });

  test("teardown is LIFO", async ({ events }) => {
    // The "resolves dependencies by name" test built tmp → client,
    // so it must have torn down client → tmp.
    const trace = events.join(" ");
    expect(trace).toContain("tmp:setup client:setup");
    expect(trace).toContain("client:teardown tmp:teardown");
  });
});

describe("parameterization", () => {
  const seen: string[] = [];

  test("runs once per param", async ({ mode }) => {
    seen.push(mode);
    expect(["fast", "slow"]).toContain(mode);
  });

  test("produces the cartesian product", async ({ mode, region }) => {
    seen.push(`${mode}/${region}`);
    expect(`${mode}/${region}`).toMatch(/^(fast|slow)\/(eu|us)$/);
  });

  test("...which means 2 + 4 cases ran before this one", () => {
    expect(seen.sort()).toEqual([
      "fast",
      "fast/eu",
      "fast/us",
      "slow",
      "slow/eu",
      "slow/us",
    ]);
  });
});

describe("iteration protocol (opts.iterate)", () => {
  test(
    "builds test-scoped fixtures per ctx.iterate call while session/file stay shared",
    async (ctx) => {
      // The wrapper context holds no test-scope values…
      expect("tmp" in ctx).toBe(false);
      // …but session and file fixtures are built eagerly.
      expect(Array.isArray(ctx.events)).toBe(true);
      expect(Array.isArray(ctx.db.rows)).toBe(true);

      const before = ctx.events.length;
      const rowsBefore = ctx.db.rows.length;
      const first = await ctx.iterate!((i) => {
        i.db.rows.push("from-iteration-1");
        return i.tmp;
      });
      const second = await ctx.iterate!((i) => i.tmp);

      // A fresh test-scope instance per call…
      expect(first).not.toBe(second);
      // …while the file-scope instance is shared — across iterations and
      // with the wrapper.
      expect(ctx.db.rows.slice(rowsBefore)).toEqual(["from-iteration-1"]);

      // Each call built tmp and tore it down, strictly LIFO.
      expect(ctx.events.slice(before)).toEqual([
        "tmp:setup",
        "tmp:teardown",
        "tmp:setup",
        "tmp:teardown",
      ]);
    },
    { fixtures: ["events", "db", "tmp"], iterate: true },
  );

  test(
    "runs full teardown on every iterate call, even when the body throws",
    async (ctx) => {
      const before = ctx.events.length;
      let calls = 0;
      const run = (fail: boolean) =>
        ctx.iterate!(() => {
          calls++;
          if (fail) throw new Error("predicate failed — a shrink step");
        });

      await run(false);
      await expect(run(true)).rejects.toThrow("predicate failed");
      await run(false);

      expect(calls).toBe(3);
      // Property runners need exactly this guarantee for shrink cycles:
      // teardown executes per sample and nothing leaks across failures.
      expect(ctx.events.slice(before)).toEqual([
        "tmp:setup",
        "tmp:teardown",
        "tmp:setup",
        "tmp:teardown",
        "tmp:setup",
        "tmp:teardown",
      ]);
    },
    { fixtures: ["events", "tmp"], iterate: true },
  );

  test(
    "returns the body result and skips test-scope instantiation at the wrapper",
    async (ctx) => {
      const before = ctx.events.length;
      const out = await ctx.iterate!(() => 42);
      expect(out).toBe(42);
      // Nothing happened before the iterate call — tmp is built per call.
      expect(ctx.events.slice(before)).toEqual(["tmp:setup", "tmp:teardown"]);
    },
    { fixtures: ["events", "tmp"], iterate: true },
  );
});

describe("engine internals", () => {
  const map = fixturesFor(here);

  test("merges every fixtures.ts from the root down to this directory", () => {
    expect(Object.keys(map).sort()).toEqual([
      "answer",
      "client",
      "config",
      "db",
      "events",
      "mode",
      "origin",
      "region",
      "tmp",
    ]);
  });

  test("orders dependencies first", () => {
    expect(resolveOrder(["client"], map, here)).toEqual([
      "events",
      "tmp",
      "client",
    ]);
  });

  test("throws on an unknown fixture", () => {
    expect(() => resolveOrder(["nope"], map, here)).toThrow(
      /unknown fixture "nope"/,
    );
  });

  test("throws on a scope violation", () => {
    const bad = {
      short: { scope: "test" as const, setup: async (use: any) => use(1) },
      long: {
        scope: "session" as const,
        deps: ["short"],
        setup: async (use: any) => use(2),
      },
    };
    expect(() => resolveOrder(["long"], bad, here)).toThrow(/scope mismatch/);
  });

  test("throws on a dependency cycle", () => {
    const cyclic = {
      a: { deps: ["b"], setup: async (use: any) => use(1) },
      b: { deps: ["a"], setup: async (use: any) => use(2) },
    };
    expect(() => resolveOrder(["a"], cyclic, here)).toThrow(
      /circular fixture dependency/,
    );
  });

  test("computes param combinations", () => {
    expect(paramCombos(["mode", "region"], map)).toEqual([
      { mode: 0, region: 0 },
      { mode: 0, region: 1 },
      { mode: 1, region: 0 },
      { mode: 1, region: 1 },
    ]);
  });

  test("detects destructured parameters", () => {
    expect(
      destructuredKeys(async (use: any, { db, tmp }: any) => [use, db, tmp], 1),
    ).toEqual(["db", "tmp"]);
    expect(destructuredKeys(({ a = 1, b: c }: any) => [a, c], 0)).toEqual([
      "a",
      "b",
    ]);
    expect(destructuredKeys((ctx: any) => ctx, 0)).toEqual([]);
  });

  test("createTest binds to an explicit file", () => {
    const bound = createTest(here);
    expect(typeof bound.test).toBe("function");
    expect(bound.expect).toBe(expect);
  });
});

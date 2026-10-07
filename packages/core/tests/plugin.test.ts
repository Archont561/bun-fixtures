import {
  test as base,
  configureDiagnostics,
  createFixture,
  createTest,
  describe,
  destructuredKeys,
  expect,
  reportDiagnostic,
  resolveOrder,
  UnknownFixtureError,
} from "@/plugin.ts";
import fixtures from "./fixtures.ts";

const here = import.meta.path;
const test = base.extend(fixtures);

test("createFixture exposes a typed fixture declaration", () => {
  const definition = createFixture({
    scope: "test" as const,
    setup: async (use) => {
      await use({ ready: true });
    },
  });

  expect(definition.scope).toBe("test");
  expect(typeof definition.setup).toBe("function");
});

describe("injection", () => {
  test("injects a session fixture", async ({ config }) => {
    expect(config.name).toBe("bun-test-utils");
  });

  test("uses fixtures composed with test.extend()", async ({ origin }) => {
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

/**
 * Pins ADR-0020: parameterized fixtures are removed. A `params` key is
 * ignored like any other unknown fixture-definition key — the test is
 * registered exactly once, under exactly the name it was given, and
 * `ctx.param` is not injected.
 */
describe("parameterization removal (ADR 0020)", () => {
  const runs: Array<{ param: unknown; legacy: unknown }> = [];

  const legacyTest = base.extend({
    legacy: {
      params: ["a", "b"],
      setup: async (use: any, ctx: any) => {
        await use(ctx.param);
      },
    },
  } as any);

  legacyTest(
    "ignores params and injects no ctx.param",
    async (ctx: any) => {
      runs.push({ param: ctx.param, legacy: ctx.legacy });
    },
    { fixtures: ["legacy"] },
  );

  test("...which means it ran exactly once, with no param", () => {
    expect(runs).toEqual([{ param: undefined, legacy: undefined }]);
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
  const map = fixtures;

  test("uses only the explicitly composed fixture map", () => {
    expect(Object.keys(map).sort()).toEqual([
      "answer",
      "client",
      "config",
      "db",
      "events",
      "origin",
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

  test("throws on an unknown fixture with test.extend() guidance", () => {
    expect(() => resolveOrder(["nope"], map, here)).toThrow(
      /unknown fixture "nope".*test\.extend/s,
    );
  });

  test("unknown fixture errors expose a stable code and details", () => {
    let error: unknown;
    try {
      resolveOrder(["nope"], map, here);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(UnknownFixtureError);
    expect((error as UnknownFixtureError).code).toBe("UNKNOWN_FIXTURE");
    expect((error as UnknownFixtureError).details?.name).toBe("nope");
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

  test("nested extend chains preserve dependency ordering", () => {
    const nestedMap = {
      ...map,
      first: { setup: async (use: any) => use(1) },
      second: { deps: ["first"], setup: async (use: any) => use(2) },
      third: { deps: ["second"], setup: async (use: any) => use(3) },
    };
    expect(resolveOrder(["third"], nestedMap, here)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  test("createTest binds to an explicit file", () => {
    const bound = createTest(here);
    expect(typeof bound.test).toBe("function");
    expect(bound.expect).toBe(expect);
  });

  test("diagnostics are opt-in and structured", () => {
    const events: any[] = [];
    const restore = configureDiagnostics((event) => events.push(event));
    try {
      reportDiagnostic({
        code: "FIXTURE_COMPOSITION",
        message: "composition diagnostic",
        details: { fixture: "db" },
      });
    } finally {
      restore();
    }
    expect(events).toEqual([
      {
        code: "FIXTURE_COMPOSITION",
        message: "composition diagnostic",
        details: { fixture: "db" },
      },
    ]);
  });
});

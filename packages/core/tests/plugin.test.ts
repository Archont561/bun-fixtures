import {
  test as base,
  configureDiagnostics,
  createFixture,
  createTest,
  describe,
  destructuredKeys,
  expect,
  openFixtures,
  reportDiagnostic,
  resolveOrder,
  UnknownFixtureError,
} from "@/plugin.ts";
import type { FixtureMap } from "@/types.ts";
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

  // ADR 0025: a failing sample starts the failure, so it is what the runner
  // sees; the teardown error is attached rather than replacing it.
  const flaky = base.extend({
    flaky: {
      setup: async (use) => {
        await use("value");
        throw new Error("teardown of flaky failed");
      },
    },
  } satisfies FixtureMap);

  flaky(
    "reports the sample failure and attaches the teardown error",
    async (ctx) => {
      let caught: any;
      try {
        await ctx.iterate!(() => {
          throw new Error("sample failed");
        });
      } catch (error) {
        caught = error;
      }

      expect(caught?.message).toBe("sample failed");
      expect(caught?.suppressed).toHaveLength(1);
      expect(caught?.suppressed?.[0]?.message).toBe("teardown of flaky failed");
    },
    { fixtures: ["flaky"], iterate: true },
  );

  // The ADR 0025 carve-out: a thrown non-object has nowhere to put
  // `suppressed`, and wrapping it would change what the caller catches. So it
  // is rethrown unchanged and the teardown error is dropped — dropped, but not
  // promoted over the failure that started.
  flaky(
    "rethrows a non-object sample failure unchanged",
    async (ctx) => {
      const failure: unknown = "sample failed with a string";
      let caught: unknown;
      try {
        await ctx.iterate!(() => {
          throw failure;
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBe(failure);
    },
    { fixtures: ["flaky"], iterate: true },
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

describe("fixture teardown", () => {
  test("a teardown error rejects close() with that error", async () => {
    const map = {
      flaky: {
        scope: "test",
        setup: async (use) => {
          await use("value");
          throw new Error("teardown exploded");
        },
      },
    } satisfies FixtureMap;
    const { close } = await openFixtures(map, ["flaky"], { testFile: here });
    await expect(close()).rejects.toThrow("teardown exploded");
  });

  test("a setup that throws before use() surfaces its own error", async () => {
    const map = {
      broken: {
        scope: "test",
        setup: async () => {
          throw new Error("setup exploded");
        },
      },
    } satisfies FixtureMap;
    await expect(
      openFixtures(map, ["broken"], { testFile: here }),
    ).rejects.toThrow("setup exploded");
  });

  test("teardowns run in reverse setup order and a failing one does not skip the rest", async () => {
    const events: string[] = [];
    const map = {
      first: {
        scope: "test",
        setup: async (use) => {
          await use("first");
          events.push("first:teardown");
        },
      },
      second: {
        scope: "test",
        setup: async (use) => {
          await use("second");
          events.push("second:teardown");
          throw new Error("second teardown exploded");
        },
      },
    } satisfies FixtureMap;
    const { close } = await openFixtures(map, ["first", "second"], {
      testFile: here,
    });
    await expect(close()).rejects.toThrow("second teardown exploded");
    expect(events).toEqual(["second:teardown", "first:teardown"]);
  });

  test("a later setup failure tears down fixtures already built and rejects with that failure", async () => {
    const events: string[] = [];
    const map = {
      a: {
        scope: "test",
        setup: async (use) => {
          events.push("a:setup");
          await use("a");
          events.push("a:teardown");
        },
      },
      b: {
        scope: "test",
        setup: async () => {
          events.push("b:setup-throws");
          throw new Error("b failed");
        },
      },
    } satisfies FixtureMap;

    await expect(
      openFixtures(map, ["a", "b"], { testFile: here }),
    ).rejects.toThrow("b failed");
    expect(events).toEqual(["a:setup", "b:setup-throws", "a:teardown"]);
  });

  test("fixtures built before a later setup failure tear down in LIFO order", async () => {
    const events: string[] = [];
    const map = {
      first: {
        scope: "test",
        setup: async (use) => {
          events.push("first:setup");
          await use("first");
          events.push("first:teardown");
        },
      },
      second: {
        scope: "test",
        setup: async (use) => {
          events.push("second:setup");
          await use("second");
          events.push("second:teardown");
        },
      },
      third: {
        scope: "test",
        setup: async () => {
          events.push("third:setup-throws");
          throw new Error("third failed");
        },
      },
    } satisfies FixtureMap;

    await expect(
      openFixtures(map, ["first", "second", "third"], { testFile: here }),
    ).rejects.toThrow("third failed");
    expect(events).toEqual([
      "first:setup",
      "second:setup",
      "third:setup-throws",
      "second:teardown",
      "first:teardown",
    ]);
  });

  test("a teardown failure during that cleanup does not replace the setup error, and the rest still run", async () => {
    const events: string[] = [];
    const map = {
      first: {
        scope: "test",
        setup: async (use) => {
          await use("first");
          events.push("first:teardown");
        },
      },
      second: {
        scope: "test",
        setup: async (use) => {
          await use("second");
          throw new Error("second teardown failed");
        },
      },
      third: {
        scope: "test",
        setup: async () => {
          throw new Error("third failed");
        },
      },
    } satisfies FixtureMap;

    await expect(
      openFixtures(map, ["first", "second", "third"], { testFile: here }),
    ).rejects.toThrow("third failed");
    expect(events).toEqual(["first:teardown"]);
  });

  // ADR 0025: with nothing in flight, the first LIFO teardown error is still
  // what close() rejects with — the rest are attached instead of dropped.
  test("a teardown error attaches the other teardown errors instead of dropping them", async () => {
    const events: string[] = [];
    const map = {
      first: {
        scope: "test",
        setup: async (use) => {
          await use("first");
          events.push("first:teardown");
          throw new Error("first teardown failed");
        },
      },
      second: {
        scope: "test",
        setup: async (use) => {
          await use("second");
          events.push("second:teardown");
          throw new Error("second teardown failed");
        },
      },
    } satisfies FixtureMap;

    const { close } = await openFixtures(map, ["first", "second"], {
      testFile: here,
    });

    let caught: any;
    try {
      await close();
    } catch (error) {
      caught = error;
    }

    // LIFO: `second` unwinds first, so its error is the one thrown…
    expect(caught?.message).toBe("second teardown failed");
    // …and `first`'s survives on suppressed rather than vanishing.
    expect(caught?.suppressed).toHaveLength(1);
    expect(caught?.suppressed?.[0]?.message).toBe("first teardown failed");
    expect(events).toEqual(["second:teardown", "first:teardown"]);
  });

  // ADR 0025 reverses the PR #36 drop: the setup error still wins, but the
  // cleanup failure it used to swallow is now attached to it.
  test("a failed openFixtures attaches the cleanup error to the setup error", async () => {
    const map = {
      first: {
        scope: "test",
        setup: async (use) => {
          await use("first");
          throw new Error("first teardown failed");
        },
      },
      second: {
        scope: "test",
        setup: async () => {
          throw new Error("second setup failed");
        },
      },
    } satisfies FixtureMap;

    let caught: any;
    try {
      await openFixtures(map, ["first", "second"], { testFile: here });
    } catch (error) {
      caught = error;
    }

    expect(caught?.message).toBe("second setup failed");
    expect(caught?.suppressed).toHaveLength(1);
    expect(caught?.suppressed?.[0]?.message).toBe("first teardown failed");
  });
});

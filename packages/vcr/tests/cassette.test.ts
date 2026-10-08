/**
 * The cassette fixture, composed the way a consumer composes it.
 *
 * Two composition techniques carry this file, and both are the point of it:
 *
 * 1. `createTest(<path>)` binds the fixture-aware `test` to a *scratch* test
 *    file, so the `__cassettes__/<test name>.json` convention resolves inside
 *    a temp directory instead of next to this source file. The engine still
 *    supplies `testFile`/`testName` — nothing is hand-driven — but the suite
 *    stays hermetic and repeatable, and the repository stays clean.
 * 2. Overriding the `cassette` key with the same fixture plus a `deps` entry
 *    forces `vcrEnv` to build before it and tear down after it. That is how a
 *    test selects replay mode: the engine's dependency ordering sets the
 *    environment variable before the cassette reads it, and LIFO teardown
 *    removes it again.
 *
 * Writes happen during teardown, after the body returns, so assertions about
 * what landed on disk live in the *next* test via a module-scope breadcrumb.
 */

import { afterAll, test as bunTest } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTest, type FixtureContext } from "@bun-test-utils/core";
import {
  type CassetteEntry,
  CassetteError,
  type CassetteHelper,
  cassetteFixture,
  describe,
  expect,
} from "@/index.ts";

/** Scratch project root: the convention resolves relative to this file. */
const scratchDir = mkdtempSync(join(tmpdir(), "vcr-scratch-"));
const scratchFile = join(scratchDir, "api.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

/** Mirrors the fixture's own slug rule, so expected paths cannot drift. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "cassette";

const cassettePathFor = (testName: string) =>
  join(scratchDir, "__cassettes__", `${slugify(testName)}.json`);

const { test: scratchTest } = createTest(scratchFile);

/** A live origin server, torn down by the engine when the test ends. */
const serverFixture = {
  setup: async (use: (value: { url: string; stop: () => void }) => unknown) => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/secure") return new Response("OK");
        return new Response(JSON.stringify({ hello: "vcr" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    let stopped = false;
    const stop = () => {
      if (!stopped) {
        stopped = true;
        server.stop(true);
      }
    };
    try {
      await use({ url: `http://localhost:${server.port}`, stop });
    } finally {
      stop();
    }
  },
};

const test = scratchTest.extend({
  cassette: cassetteFixture,
  server: serverFixture,
});

/**
 * Replay mode, selected declaratively: `vcrEnv` is a dependency of
 * `cassette`, so the engine builds it first and tears it down last.
 */
const replayTest = scratchTest.extend({
  vcrEnv: {
    setup: async (use: (value: string) => unknown) => {
      process.env.VCR_MODE = "replay";
      try {
        await use("replay");
      } finally {
        delete process.env.VCR_MODE;
      }
    },
  },
  cassette: { ...cassetteFixture, deps: ["vcrEnv"] },
});

const REPLAY_TEST = "replay mode auto-loads the cassette named after the test";

/** Pre-recorded cassette for the replay case, at the conventional path. */
const seededEntry: CassetteEntry = {
  request: {
    method: "GET",
    url: "https://offline.invalid/greeting",
    headers: {},
  },
  response: { status: 200, statusText: "OK", headers: {}, body: "cached!" },
};
mkdirSync(join(scratchDir, "__cassettes__"), { recursive: true });
writeFileSync(
  cassettePathFor(REPLAY_TEST),
  JSON.stringify([seededEntry]),
  "utf8",
);

const breadcrumbs: { recordedPath?: string } = {};

describe("@bun-test-utils/vcr", () => {
  test("records and replays callback output without rerunning live work", async ({
    cassette,
  }) => {
    let calls = 0;
    const loadUser = async () => {
      calls++;
      return { id: "user-1", name: "Ada" };
    };

    expect(await cassette.record(loadUser)).toEqual({
      id: "user-1",
      name: "Ada",
    });
    expect(await cassette.replay(loadUser)).toEqual({
      id: "user-1",
      name: "Ada",
    });
    expect(calls).toBe(1);
  });

  test("replay reports an unrecorded callback without invoking it", async ({
    cassette,
  }) => {
    let calls = 0;
    const loadUser = () => {
      calls++;
      return { id: "missing" };
    };

    let error: unknown;
    try {
      await cassette.replay(loadUser);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(CassetteError);
    expect((error as CassetteError).code).toBe("CALLBACK_NOT_RECORDED");
    expect((error as CassetteError).message).toContain("record(callback)");
    expect(calls).toBe(0);
  });

  test("records live requests and replays cached responses", async ({
    cassette,
    server,
  }) => {
    cassette.setMode("record");
    const res1 = await fetch(`${server.url}/test`);
    expect(res1.status).toBe(200);
    expect(await res1.json()).toEqual({ hello: "vcr" });
    expect(cassette.entries.length).toBe(1);

    // Stop the origin so replay provably does not reach the network.
    server.stop();

    cassette.setMode("replay");
    const res2 = await fetch(`${server.url}/test`);
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual({ hello: "vcr" });
  });

  test("redacts authorization header during recording", async ({
    cassette,
    server,
  }) => {
    cassette.setMode("record");
    await fetch(`${server.url}/secure`, {
      headers: { Authorization: "Bearer secret-token-123" },
    });

    expect(cassette.entries.length).toBe(1);
    expect(cassette.entries[0]!.request.headers.authorization).toBe(
      "[REDACTED]",
    );
  });
});

/** A class instance: its data is real, but its prototype is not plain. */
class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

/**
 * Records a callback whose result JSON cannot round-trip. The first `record`
 * must throw the coded diagnostic. Nothing is registered, so `replay` must then
 * report the unrecorded callback instead of returning a corrupted value.
 */
async function expectRefused(
  cassette: CassetteHelper,
  callback: () => unknown,
): Promise<CassetteError> {
  let refusal: unknown;
  try {
    await cassette.record(callback);
  } catch (caught) {
    refusal = caught;
  }
  expect(refusal).toBeInstanceOf(CassetteError);
  const error = refusal as CassetteError;
  expect(error.code).toBe("CALLBACK_NOT_SERIALIZABLE");
  expect(error.message.startsWith("[bun-test-utils/vcr] ")).toBe(true);

  let replayed: unknown;
  try {
    await cassette.replay(callback);
  } catch (caught) {
    replayed = caught;
  }
  expect(replayed).toBeInstanceOf(CassetteError);
  expect((replayed as CassetteError).code).toBe("CALLBACK_NOT_RECORDED");
  return error;
}

describe("callback results JSON cannot round-trip", () => {
  test("refuses a Date instead of replaying a string", async ({ cassette }) => {
    await expectRefused(cassette, () => new Date(0));
  });

  test("refuses a BigInt instead of replaying a string", async ({
    cassette,
  }) => {
    await expectRefused(cassette, () => 123n);
  });

  test("refuses NaN instead of replaying null", async ({ cassette }) => {
    await expectRefused(cassette, () => Number.NaN);
  });

  test("refuses Infinity instead of replaying null", async ({ cassette }) => {
    await expectRefused(cassette, () => Number.POSITIVE_INFINITY);
  });

  test("refuses -0 instead of replaying 0", async ({ cassette }) => {
    await expectRefused(cassette, () => -0);
  });

  test("refuses a class instance instead of replaying a plain object", async ({
    cassette,
  }) => {
    await expectRefused(cassette, () => new Point(1, 2));
  });

  test("refuses a Map instead of replaying {}", async ({ cassette }) => {
    await expectRefused(cassette, () => new Map([["id", "user-1"]]));
  });

  test("refuses a Set instead of replaying {}", async ({ cassette }) => {
    await expectRefused(cassette, () => new Set(["admin"]));
  });

  test("refuses an Error instead of replaying {}", async ({ cassette }) => {
    await expectRefused(cassette, () => new Error("boom"));
  });

  test("refuses a RegExp instead of replaying {}", async ({ cassette }) => {
    await expectRefused(cassette, () => /user-\d+/g);
  });

  test("refuses a typed array instead of replaying an index-keyed object", async ({
    cassette,
  }) => {
    await expectRefused(cassette, () => new Uint8Array([1, 2]));
  });

  test("names the path of a nested undefined, which JSON would drop", async ({
    cassette,
  }) => {
    const error = await expectRefused(cassette, () => ({
      id: "user-1",
      nickname: undefined,
    }));
    expect(error.message).toContain("$.nickname");
    expect(error.details).toMatchObject({
      path: "$.nickname",
      valueType: "undefined",
    });
  });

  test("names the path of a nested function, which JSON would drop", async ({
    cassette,
  }) => {
    const error = await expectRefused(cassette, () => ({
      id: "user-1",
      format: () => "ada",
    }));
    expect(error.message).toContain("$.format");
  });

  test("refuses a symbol-keyed property, which JSON would drop", async ({
    cassette,
  }) => {
    const secret = Symbol("secret");
    await expectRefused(cassette, () => ({ id: "user-1", [secret]: "hidden" }));
  });

  test("refuses a sparse array, which JSON would turn into nulls", async ({
    cassette,
  }) => {
    await expectRefused(cassette, () => {
      const items: unknown[] = [];
      items[0] = "first";
      items[2] = "third";
      return items;
    });
  });

  test("refuses a top-level function with the coded diagnostic", async ({
    cassette,
  }) => {
    await expectRefused(cassette, () => () => "not data");
  });

  test("refuses a top-level symbol with the coded diagnostic", async ({
    cassette,
  }) => {
    await expectRefused(cassette, () => Symbol("token"));
  });

  test("wraps a circular structure in a coded diagnostic, not a raw TypeError", async ({
    cassette,
  }) => {
    const error = await expectRefused(cassette, () => {
      const node: { self?: unknown } = {};
      node.self = node;
      return node;
    });
    expect(error).not.toBeInstanceOf(TypeError);
    expect(error.message).toContain("circular");
    expect(error.message).toContain("$.self");
  });

  test("still records and replays a top-level undefined", async ({
    cassette,
  }) => {
    const nothing = () => undefined;
    expect(await cassette.record(nothing)).toBeUndefined();
    expect(await cassette.replay(nothing)).toBeUndefined();
  });

  test("still records and replays nested plain data exactly", async ({
    cassette,
  }) => {
    const payload = () => ({
      id: "user-1",
      tags: ["admin", "ops"],
      count: 0,
      ratio: 0.5,
      active: true,
      owner: null,
      meta: { empty: [], nothing: {} },
    });
    expect(await cassette.record(payload)).toEqual(payload());
    expect(await cassette.replay(payload)).toEqual(payload());
  });

  test("still records and replays a null-prototype object as plain data", async ({
    cassette,
  }) => {
    const dictionary = () =>
      Object.assign(Object.create(null), { id: "user-1" }) as { id: string };
    expect((await cassette.record(dictionary)).id).toBe("user-1");
    expect((await cassette.replay(dictionary)).id).toBe("user-1");
  });

  test("still records and replays repeated references that are not cycles", async ({
    cassette,
  }) => {
    const shared = () => {
      const tag = { name: "admin" };
      return { first: tag, second: tag };
    };
    const expected = { first: { name: "admin" }, second: { name: "admin" } };
    expect(await cassette.record(shared)).toEqual(expected);
    expect(await cassette.replay(shared)).toEqual(expected);
  });
});

describe("callback identity (ADR 0027)", () => {
  /**
   * Closures from one factory share source text and differ only in captured
   * values, which a function cannot expose without running. `runs` records
   * which body actually executed, so a test can see a skipped callback.
   */
  function loaderFactory() {
    const runs: string[] = [];
    const makeLoader = (id: string) => () => {
      runs.push(id);
      return { id };
    };
    return { runs, makeLoader };
  }

  /** Replays a fresh closure that must be refused, and returns the refusal. */
  async function replayRefusal(
    cassette: CassetteHelper,
    callback: () => unknown,
  ): Promise<CassetteError> {
    let refusal: unknown;
    try {
      await cassette.replay(callback);
    } catch (caught) {
      refusal = caught;
    }
    expect(refusal).toBeInstanceOf(CassetteError);
    return refusal as CassetteError;
  }

  test("two closures from one factory each run and record their own result", async ({
    cassette,
  }) => {
    const { runs, makeLoader } = loaderFactory();

    expect(await cassette.record(makeLoader("a"))).toEqual({ id: "a" });
    expect(await cassette.record(makeLoader("b"))).toEqual({ id: "b" });
    expect(runs).toEqual(["a", "b"]);
  });

  test("replay returns the result recorded for each closure, in any order", async ({
    cassette,
  }) => {
    const { runs, makeLoader } = loaderFactory();
    const a = makeLoader("a");
    const b = makeLoader("b");

    await cassette.record(a);
    await cassette.record(b);
    expect(await cassette.replay(b)).toEqual({ id: "b" });
    expect(await cassette.replay(a)).toEqual({ id: "a" });
    expect(runs).toEqual(["a", "b"]);
  });

  test("record of a recorded closure returns its stored result without running it again", async ({
    cassette,
  }) => {
    const { runs, makeLoader } = loaderFactory();
    const a = makeLoader("a");

    expect(await cassette.record(a)).toEqual({ id: "a" });
    expect(await cassette.record(a)).toEqual({ id: "a" });
    expect(runs).toEqual(["a"]);
  });

  test("a fresh closure whose recordings disagree is refused and not run", async ({
    cassette,
  }) => {
    const { runs, makeLoader } = loaderFactory();
    await cassette.record(makeLoader("a"));
    await cassette.record(makeLoader("b"));

    const error = await replayRefusal(cassette, makeLoader("c"));
    expect(error.code).toBe("CALLBACK_AMBIGUOUS");
    expect(error.message.startsWith("[bun-test-utils/vcr] ")).toBe(true);
    expect(error.message).toContain("same function object");
    expect(error.details?.recordings).toBe(2);
    expect(runs).toEqual(["a", "b"]);
  });

  test("a fresh closure whose recordings agree returns the agreed result, not run", async ({
    cassette,
  }) => {
    const { runs, makeLoader } = loaderFactory();
    await cassette.record(makeLoader("a"));
    await cassette.record(makeLoader("a"));

    expect(await cassette.replay(makeLoader("a"))).toEqual({ id: "a" });
    expect(runs).toEqual(["a", "a"]);
  });

  test("a fresh closure matching one recording returns it: the documented limit (ADR 0027)", async ({
    cassette,
  }) => {
    const { runs, makeLoader } = loaderFactory();
    await cassette.record(makeLoader("a"));

    // Captured values differ, but the source text matches the one recording.
    expect(await cassette.replay(makeLoader("b"))).toEqual({ id: "a" });
    expect(runs).toEqual(["a"]);
  });

  test("an inline closure written with the same code replays the recording", async ({
    cassette,
  }) => {
    let runs = 0;
    expect(await cassette.record(() => ({ id: `user-${++runs}` }))).toEqual({
      id: "user-1",
    });
    expect(await cassette.replay(() => ({ id: `user-${++runs}` }))).toEqual({
      id: "user-1",
    });
    expect(runs).toBe(1);
  });

  test("concurrent record calls for one closure keep the first recording", async ({
    cassette,
  }) => {
    let started = 0;
    const slow = async () => {
      const n = ++started;
      await Bun.sleep(n === 1 ? 10 : 1);
      return { n };
    };

    const [first, second] = await Promise.all([
      cassette.record(slow),
      cassette.record(slow),
    ]);
    expect(second).toEqual(first);
    expect(await cassette.replay(slow)).toEqual(first);
  });
});

describe("__cassettes__/ convention", () => {
  test("record mode auto-saves under __cassettes__/<test name> on teardown", async ({
    cassette,
    server,
  }) => {
    const expected = cassettePathFor(
      "record mode auto-saves under __cassettes__/<test name> on teardown",
    );
    // The engine supplied testFile/testName; the fixture derived the path.
    expect(cassette.path).toBe(expected);
    breadcrumbs.recordedPath = cassette.path;

    cassette.setMode("record");
    const res = await fetch(`${server.url}/greeting`);
    expect(res.status).toBe(200);
    // Nothing is written before teardown.
    expect(existsSync(cassette.path)).toBe(false);
  });

  test("the previous test's teardown wrote the cassette to disk", async () => {
    const path = breadcrumbs.recordedPath!;
    expect(existsSync(path)).toBe(true);

    const saved = JSON.parse(readFileSync(path, "utf8")) as CassetteEntry[];
    expect(saved).toHaveLength(1);
    expect(saved[0]!.request.method).toBe("GET");
    expect(saved[0]!.request.url).toContain("/greeting");
    expect(JSON.parse(saved[0]!.response.body)).toEqual({ hello: "vcr" });
  });

  replayTest(REPLAY_TEST, async ({ cassette }) => {
    // Loaded at setup time — visible before any fetch is issued.
    expect(cassette.mode).toBe("replay");
    expect(cassette.entries).toHaveLength(1);

    const res = await fetch("https://offline.invalid/greeting");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("cached!");
  });

  test("the replay fixture's dependency restored VCR_MODE on teardown", async () => {
    expect(process.env.VCR_MODE).toBeUndefined();
  });
});

/**
 * The one case that cannot be a fixture-injected test: it asserts a failure
 * raised during *setup*. A test whose fixture setup throws is a failing test,
 * so the throw has to be observed from outside the engine's test body. The
 * fixture is still driven through its real contract — only the surrounding
 * `test()` is plain `bun:test`.
 */
describe("replay without a cassette (setup-time failure)", () => {
  bunTest(
    "replay mode without a cassette fails with an informative error",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "vcr-missing-"));
      const ctx: FixtureContext = {
        testFile: join(dir, "api.test.ts"),
        testName: "has no cassette yet",
      };

      process.env.VCR_MODE = "replay";
      let err: Error | undefined;
      try {
        await cassetteFixture.setup(async () => {}, ctx);
      } catch (caught) {
        err = caught as Error;
      } finally {
        delete process.env.VCR_MODE;
        rmSync(dir, { recursive: true, force: true });
      }

      expect(err).toBeInstanceOf(CassetteError);
      expect(err?.message).toContain("__cassettes__");
      expect(err?.message).toContain("VCR_MODE=record");
    },
  );
});

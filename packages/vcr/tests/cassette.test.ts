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

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { FixtureContext } from "bun-test-utils";
import type { CassetteEntry } from "../src/index.ts";
import { cassetteFixture } from "../src/index.ts";

/**
 * Direct fixture calls pass a scratch `testFile` in `tmp` so any automatic
 * cassette writes stay out of the repository — under the engine, the
 * convention lands next to the real test file instead.
 */
function scratch(testName?: string): { dir: string; ctx: FixtureContext } {
  const dir = mkdtempSync(join(tmpdir(), "vcr-scratch-"));
  return { dir, ctx: { testFile: join(dir, "api.test.ts"), testName } };
}

describe("@bun-test-utils/vcr", () => {
  test("records live requests and replays cached responses", async () => {
    // Start local mock server
    const server = Bun.serve({
      port: 0,
      fetch(_req) {
        return new Response(JSON.stringify({ hello: "vcr" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const { dir, ctx } = scratch();

    const url = `http://localhost:${server.port}/test`;

    try {
      await cassetteFixture.setup(async (vcr) => {
        vcr.setMode("record");
        const res1 = await fetch(url);
        expect(res1.status).toBe(200);
        expect(await res1.json()).toEqual({ hello: "vcr" });
        expect(vcr.entries.length).toBe(1);

        // Stop server so we know replay doesn't hit network
        server.stop(true);

        vcr.setMode("replay");
        const res2 = await fetch(url);
        expect(res2.status).toBe(200);
        expect(await res2.json()).toEqual({ hello: "vcr" });
      }, ctx);
    } finally {
      server.stop(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("redacts authorization header during recording", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("OK");
      },
    });
    const { dir, ctx } = scratch();

    try {
      await cassetteFixture.setup(async (vcr) => {
        vcr.setMode("record");
        await fetch(`http://localhost:${server.port}/secure`, {
          headers: { Authorization: "Bearer secret-token-123" },
        });

        expect(vcr.entries.length).toBe(1);
        expect(vcr.entries[0].request.headers.authorization).toBe("[REDACTED]");
      }, ctx);
    } finally {
      server.stop(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("__cassettes__/ convention", () => {
  test("record mode auto-saves under __cassettes__/<test name> on teardown", async () => {
    const { dir, ctx } = scratch("fetches the greeting");
    const cassettePath = join(
      dir,
      "__cassettes__",
      "fetches-the-greeting.json",
    );
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(JSON.stringify({ hello: "vcr" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    try {
      await cassetteFixture.setup(async (vcr) => {
        // The convention path is exposed for debugging and tooling.
        expect(vcr.path).toBe(cassettePath);
        vcr.setMode("record");
        const res = await fetch(`http://localhost:${server.port}/greeting`);
        expect(res.status).toBe(200);
        // Nothing is written before teardown.
        expect(existsSync(cassettePath)).toBe(false);
      }, ctx);

      expect(existsSync(cassettePath)).toBe(true);
      const saved = JSON.parse(
        readFileSync(cassettePath, "utf8"),
      ) as CassetteEntry[];
      expect(saved).toHaveLength(1);
      expect(saved[0].request.method).toBe("GET");
      expect(saved[0].request.url).toContain("/greeting");
      expect(JSON.parse(saved[0].response.body)).toEqual({ hello: "vcr" });
    } finally {
      server.stop(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("replay mode auto-loads the cassette named after the test", async () => {
    const { dir, ctx } = scratch("serves the cached greeting");
    const cassettePath = join(
      dir,
      "__cassettes__",
      "serves-the-cached-greeting.json",
    );
    mkdirSync(dirname(cassettePath), { recursive: true });
    const entry: CassetteEntry = {
      request: {
        method: "GET",
        url: "https://offline.invalid/greeting",
        headers: {},
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "cached!",
      },
    };
    writeFileSync(cassettePath, JSON.stringify([entry]));

    process.env.VCR_MODE = "replay";
    try {
      await cassetteFixture.setup(async (vcr) => {
        // Loaded at setup time — visible before any fetch is issued.
        expect(vcr.entries).toHaveLength(1);
        const res = await fetch("https://offline.invalid/greeting");
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("cached!");
      }, ctx);
    } finally {
      delete process.env.VCR_MODE;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("replay mode without a cassette fails with an informative error", async () => {
    const { dir, ctx } = scratch("has no cassette yet");

    process.env.VCR_MODE = "replay";
    let err: Error | undefined;
    try {
      await cassetteFixture.setup(async () => {}, ctx);
    } catch (e) {
      err = e as Error;
    } finally {
      delete process.env.VCR_MODE;
      rmSync(dir, { recursive: true, force: true });
    }
    expect(err?.message).toContain("__cassettes__");
    expect(err?.message).toContain("VCR_MODE=record");
  });
});

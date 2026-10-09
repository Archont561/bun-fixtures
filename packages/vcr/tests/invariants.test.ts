/**
 * Algebraic invariants of the cassette fixture, via test.prop.
 *
 * Callback record→replay identity, and HTTP matching by uppercase method
 * plus exact full URL (headers are stored, never consulted). Scratch
 * `createTest` keeps `__cassettes__/` out of the tree.
 */
import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTest } from "@bun-test-utils/core";
import { withPropertyTesting } from "@bun-test-utils/pbt";
import { CassetteError, cassetteFixture, describe, expect } from "@/index.ts";

const scratchDir = mkdtempSync(join(tmpdir(), "vcr-prop-"));
const scratchFile = join(scratchDir, "invariants.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

const serverFixture = {
  scope: "session" as const,
  setup: async (use: (value: { url: string }) => unknown) => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        return new Response(
          JSON.stringify({ method: req.method, path: url.pathname }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    try {
      await use({ url: `http://127.0.0.1:${server.port}` });
    } finally {
      server.stop(true);
    }
  },
};

const { test: scratchTest } = createTest(scratchFile);
const test = withPropertyTesting(
  scratchTest.extend({
    cassette: cassetteFixture,
    server: serverFixture,
  }),
  scratchFile,
);

describe("@bun-test-utils/vcr callback invariants", () => {
  test.prop(
    "record then replay returns the serialized callback output without rerunning",
    (fc) => ({
      // ADR 0034: the built-in number serializer round-trips -0 exactly, so
      // generated JSON values no longer need canonicalization.
      value: fc.jsonValue({ maxDepth: 3 }),
    }),
    async ({ cassette }, { value }) => {
      let calls = 0;
      const load = () => {
        calls++;
        return value;
      };
      const recorded = await cassette.record(load);
      expect(recorded).toEqual(value);
      expect(calls).toBe(1);

      const replayed = await cassette.replay(load);
      expect(replayed).toEqual(value);
      expect(calls).toBe(1);
    },
    { numRuns: 40, seed: 20261007 },
  );

  test.prop(
    "record then replay round-trips serializer-backed values exactly",
    (fc) => ({
      value: fc.oneof(
        fc.date({ noInvalidDate: true }),
        fc.bigInt(),
        fc.map(fc.string(), fc.date({ noInvalidDate: true })),
        fc.set(fc.string()),
        fc.constantFrom(
          Number.NaN,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          -0,
        ),
        fc.record({
          at: fc.date({ noInvalidDate: true }),
          tags: fc.set(fc.string()),
          amount: fc.bigInt(),
          pattern: fc.constant(/^[a-z]+$/g),
        }),
      ),
    }),
    async ({ cassette }, { value }) => {
      let calls = 0;
      const load = () => {
        calls++;
        return value;
      };

      expect(await cassette.record(load)).toEqual(value);
      expect(calls).toBe(1);
      expect(await cassette.replay(load)).toEqual(value);
      expect(calls).toBe(1);
    },
    { numRuns: 40, seed: 20261007 },
  );
});

describe("@bun-test-utils/vcr HTTP matching invariants", () => {
  test.prop(
    "replay matches by uppercase method and exact URL; headers do not participate",
    (fc) => ({
      method: fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
      id: fc.stringMatching(/^[a-z0-9]{8}$/),
      headerA: fc.stringMatching(/^[a-z0-9]{1,12}$/),
      headerB: fc.stringMatching(/^[a-z0-9]{1,12}$/),
    }),
    async ({ cassette, server }, { method, id, headerA, headerB }) => {
      const verb = method as string;
      const pathId = id as string;
      const live = `${server.url}/p/${pathId}`;
      cassette.setMode("record");
      const res1 = await fetch(live, {
        method: verb,
        headers: { "x-prop": headerA as string },
      });
      const body1 = await res1.text();
      expect(cassette.entries).toHaveLength(1);
      const recorded = cassette.entries[0]!.request;
      expect(recorded.method).toBe(verb);
      expect(recorded.url).toContain(`/p/${pathId}`);

      cassette.setMode("replay");
      const res2 = await fetch(recorded.url, {
        method: verb,
        headers: { "x-prop": headerB as string },
      });
      expect(await res2.text()).toBe(body1);

      const otherMethod = verb === "GET" ? "POST" : "GET";
      let methodMismatch: unknown;
      try {
        await fetch(recorded.url, { method: otherMethod });
      } catch (caught) {
        methodMismatch = caught;
      }
      expect(methodMismatch).toBeInstanceOf(CassetteError);
      expect((methodMismatch as CassetteError).code).toBe("CASSETTE_MISMATCH");

      let urlMismatch: unknown;
      try {
        await fetch(`${recorded.url}/nope`, { method: verb });
      } catch (caught) {
        urlMismatch = caught;
      }
      expect(urlMismatch).toBeInstanceOf(CassetteError);
      expect((urlMismatch as CassetteError).code).toBe("CASSETTE_MISMATCH");
    },
    { numRuns: 25, seed: 20261007 },
  );
});

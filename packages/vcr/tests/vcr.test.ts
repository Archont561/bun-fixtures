import { describe, expect, test } from "bun:test";
import { cassetteFixture } from "../src/index.ts";

describe("@bun-fixture/vcr", () => {
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

    const url = `http://localhost:${server.port}/test`;

    try {
      await cassetteFixture.setup(
        async (vcr) => {
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
        },
        { testFile: import.meta.path },
      );
    } finally {
      server.stop(true);
    }
  });

  test("redacts authorization header during recording", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("OK");
      },
    });

    try {
      await cassetteFixture.setup(
        async (vcr) => {
          vcr.setMode("record");
          await fetch(`http://localhost:${server.port}/secure`, {
            headers: { Authorization: "Bearer secret-token-123" },
          });

          expect(vcr.entries.length).toBe(1);
          expect(vcr.entries[0].request.headers.authorization).toBe(
            "[REDACTED]",
          );
        },
        { testFile: import.meta.path },
      );
    } finally {
      server.stop(true);
    }
  });
});

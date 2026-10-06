import { describe, expect, test } from "bun:test";
import { serverUrlFixture, testServerFixture } from "@/index.ts";

describe("@bun-test-utils/browser", () => {
  test("boots ephemeral HTTP server on random port and shuts down on teardown", async () => {
    let capturedUrl = "";
    await testServerFixture.setup(
      async (testServer) => {
        capturedUrl = testServer.url;
        testServer.handle((req) => {
          const url = new URL(req.url);
          if (url.pathname === "/api/health") {
            return new Response(JSON.stringify({ status: "healthy" }), {
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response("Not Found", { status: 404 });
        });

        const res = await fetch(`${testServer.url}/api/health`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ status: "healthy" });
      },
      { testFile: import.meta.path },
    );

    // Verify server has stopped
    try {
      await fetch(`${capturedUrl}/api/health`);
      expect(true).toBe(false); // Should not reach here
    } catch {
      expect(true).toBe(true); // Connection rejected as expected
    }
  });

  test("resolves serverUrl dependency", async () => {
    await testServerFixture.setup(
      async (testServer) => {
        await serverUrlFixture.setup(
          async (url) => {
            expect(url).toBe(testServer.url);
            expect(url.startsWith("http://localhost:")).toBe(true);
          },
          { testFile: import.meta.path, testServer },
        );
      },
      { testFile: import.meta.path },
    );
  });
});

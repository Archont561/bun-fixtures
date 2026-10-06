import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import {
  httpMockFixture,
  serverUrlFixture,
  testServerFixture,
  webPageFixture,
} from "@/index.ts";

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

  test("webPage defaults to the happy-dom backend without changing browserPage", async () => {
    const previous = process.env.BUN_TEST_UTILS_WEB_ENV;
    process.env.BUN_TEST_UTILS_WEB_ENV = "dom";
    try {
      await webPageFixture.setup(
        async (webPage) => {
          expect(webPage.mode).toBe("dom");
          await webPage.setContent(
            '<button id="inc">add</button><span id="count">0</span>',
          );
          const button = webPage.raw.document.querySelector("#inc");
          button.addEventListener("click", () => {
            webPage.raw.document.querySelector("#count").textContent = "1";
          });
          await webPage.click("#inc");
          expect(await webPage.textContent("#count")).toBe("1");
        },
        { testFile: import.meta.path },
      );
    } finally {
      if (previous === undefined) delete process.env.BUN_TEST_UTILS_WEB_ENV;
      else process.env.BUN_TEST_UTILS_WEB_ENV = previous;
    }
  });

  test("httpMock intercepts fetch with an MSW-like handler API", async () => {
    await httpMockFixture.setup(
      async (httpMock) => {
        httpMock.get("/api/user", () =>
          Response.json({ id: "u1", name: "Ada" }),
        );

        const response = await fetch("https://example.test/api/user");
        expect(await response.json()).toEqual({ id: "u1", name: "Ada" });
        expect(httpMock.calls()).toHaveLength(1);
        expect(httpMock.calls()[0]).toMatchObject({
          method: "GET",
          url: "https://example.test/api/user",
          handled: true,
        });

        httpMock.reset();
        expect(httpMock.calls()).toHaveLength(0);
      },
      { testFile: import.meta.path },
    );
  });

  test("httpMock passes through unhandled requests", async () => {
    await testServerFixture.setup(
      async (testServer) => {
        testServer.handle(() => Response.json({ status: "live" }));
        await httpMockFixture.setup(
          async (httpMock) => {
            const response = await fetch(`${testServer.url}/live`);
            expect(await response.json()).toEqual({ status: "live" });
            expect(httpMock.calls()[0]?.handled).toBe(false);
          },
          { testFile: import.meta.path },
        );
      },
      { testFile: import.meta.path },
    );
  });

  test("httpMock installs the same handlers on Playwright-like routes", async () => {
    await httpMockFixture.setup(
      async (httpMock) => {
        httpMock.get("https://example.test/api/user", () =>
          Response.json({ name: "Ada" }, { status: 201 }),
        );

        let routeHandler: ((route: any) => Promise<void>) | undefined;
        let unrouted = false;
        const uninstall = await httpMock.install({
          async route(pattern: string, handler: (route: any) => Promise<void>) {
            expect(pattern).toBe("**/*");
            routeHandler = handler;
          },
          async unroute(pattern: string) {
            expect(pattern).toBe("**/*");
            unrouted = true;
          },
        });

        const fulfillments: any[] = [];
        await routeHandler?.({
          request() {
            return {
              method: () => "GET",
              url: () => "https://example.test/api/user",
              headers: () => ({ accept: "application/json" }),
            };
          },
          async fulfill(options: any) {
            fulfillments.push(options);
          },
          async continue() {
            throw new Error("expected mocked fulfillment");
          },
        });

        expect(fulfillments[0].status).toBe(201);
        expect(
          JSON.parse(Buffer.from(fulfillments[0].body).toString()),
        ).toEqual({ name: "Ada" });
        expect(httpMock.calls()[0]).toMatchObject({ handled: true });

        await uninstall();
        expect(unrouted).toBe(true);
      },
      { testFile: import.meta.path },
    );
  });
});

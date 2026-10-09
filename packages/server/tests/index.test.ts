/**
 * The server fixtures, composed the way a consumer composes them.
 *
 * `serverUrl` declares `testServer` as a dependency, so asking for both
 * proves the engine resolved one from the other rather than the suite wiring
 * it. Teardown runs after the body returns, so "the server really stopped" is
 * asserted by the test that follows, via a module-scope breadcrumb.
 */

import { Buffer } from "node:buffer";
import {
  describe,
  expect,
  type HttpMockHelper,
  type TestServerHelper,
  test,
} from "@/index.ts";

const breadcrumbs: { url?: string } = {};

describe("@bun-test-utils/server", () => {
  test("boots an ephemeral HTTP server on a random port", async ({
    testServer,
  }) => {
    const server: TestServerHelper = testServer;
    breadcrumbs.url = server.url;
    expect(server.url.startsWith("http://localhost:")).toBe(true);

    server.handle((req) => {
      const url = new URL(req.url);
      if (url.pathname === "/api/health")
        return new Response(JSON.stringify({ status: "healthy" }), {
          headers: { "Content-Type": "application/json" },
        });
      return new Response("Not Found", { status: 404 });
    });

    const res = await fetch(`${server.url}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "healthy" });
  });

  test("engine teardown shut the previous test's server down", async () => {
    expect(breadcrumbs.url).toBeDefined();
    let reachable = true;
    try {
      await fetch(`${breadcrumbs.url}/api/health`);
    } catch {
      reachable = false;
    }
    expect(reachable).toBe(false);
  });

  test("resolves the serverUrl → testServer dependency", async ({
    testServer,
    serverUrl,
  }) => {
    expect(serverUrl).toBe((testServer as TestServerHelper).url);
    expect(serverUrl.startsWith("http://localhost:")).toBe(true);
  });

  test("httpMock intercepts fetch with an MSW-like handler API", async ({
    httpMock,
  }) => {
    const mock: HttpMockHelper = httpMock;
    mock.get("/api/user", () => Response.json({ id: "u1", name: "Ada" }));

    const response = await fetch("https://example.test/api/user");
    expect(await response.json()).toEqual({ id: "u1", name: "Ada" });
    expect(mock.calls()).toHaveLength(1);
    expect(mock.calls()[0]).toMatchObject({
      method: "GET",
      url: "https://example.test/api/user",
      handled: true,
    });

    mock.reset();
    expect(mock.calls()).toHaveLength(0);
  });

  test("httpMock passes through unhandled requests", async ({
    testServer,
    httpMock,
  }) => {
    const server: TestServerHelper = testServer;
    server.handle(() => Response.json({ status: "live" }));

    const response = await fetch(`${server.url}/live`);
    expect(await response.json()).toEqual({ status: "live" });
    expect((httpMock as HttpMockHelper).calls()[0]?.handled).toBe(false);
  });

  test("httpMock installs the same handlers on Playwright-like routes", async ({
    httpMock,
  }) => {
    const mock: HttpMockHelper = httpMock;
    mock.get("https://example.test/api/user", () =>
      Response.json({ name: "Ada" }, { status: 201 }),
    );

    let routeHandler: ((route: any) => Promise<void>) | undefined;
    let unrouted = false;
    const uninstall = await mock.install({
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
    expect(JSON.parse(Buffer.from(fulfillments[0].body).toString())).toEqual({
      name: "Ada",
    });
    expect(mock.calls()[0]).toMatchObject({ handled: true });

    await uninstall();
    expect(unrouted).toBe(true);
  });

  test("httpMock.reset() removes handlers, so the same URL passes through", async ({
    testServer,
    httpMock,
  }) => {
    const server: TestServerHelper = testServer;
    const mock: HttpMockHelper = httpMock;
    server.handle(() => Response.json({ source: "server" }));
    mock.get("/data", () => Response.json({ source: "mock" }));

    expect(await (await fetch(`${server.url}/data`)).json()).toEqual({
      source: "mock",
    });

    mock.reset();
    expect(await (await fetch(`${server.url}/data`)).json()).toEqual({
      source: "server",
    });
    expect(mock.calls().map((call) => call.handled)).toEqual([false]);
  });

  test("httpMock handlers registered in one test are not visible to the next", async ({
    httpMock,
  }) => {
    const mock: HttpMockHelper = httpMock;
    mock.get("/shared", () => Response.json({ source: "mock" }));

    expect(await (await fetch("https://example.test/shared")).json()).toEqual({
      source: "mock",
    });
  });

  test("a fresh httpMock starts empty, with no inherited handlers or calls", async ({
    testServer,
    httpMock,
  }) => {
    const server: TestServerHelper = testServer;
    const mock: HttpMockHelper = httpMock;
    expect(mock.calls()).toHaveLength(0);

    server.handle(() => Response.json({ source: "server" }));
    expect(await (await fetch(`${server.url}/shared`)).json()).toEqual({
      source: "server",
    });
    expect(mock.calls()[0]?.handled).toBe(false);
  });

  test("httpMock's own properties are exactly its documented API", ({
    httpMock,
  }) => {
    expect(Object.getOwnPropertyNames(httpMock).sort()).toEqual([
      "calls",
      "delete",
      "get",
      "head",
      "install",
      "options",
      "passthrough",
      "patch",
      "post",
      "put",
      "reset",
      "use",
    ]);
  });
});

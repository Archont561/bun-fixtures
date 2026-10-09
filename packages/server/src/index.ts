import { Buffer } from "node:buffer";
import {
  BunTestUtilsError,
  test as baseTest,
  createFixture,
  type FixtureMap,
  installFetchInterceptor,
  matchesFetch,
} from "@bun-test-utils/core";
import type { Server } from "bun";

export interface TestServerHelper {
  url: string;
  port: number;
  server: Server<unknown>;
  /** Sets or updates the request handler function. */
  handle(fn: (req: Request) => Response | Promise<Response>): void;
}

export const testServerFixture = createFixture<TestServerHelper>({
  scope: "test",
  setup: async (use) => {
    let handler: (req: Request) => Response | Promise<Response> = () =>
      new Response("OK", { status: 200 });

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        return handler(req);
      },
    });

    const port = server.port ?? 0;
    const helper: TestServerHelper = {
      url: `http://localhost:${port}`,
      port,
      server,
      handle(fn) {
        handler = fn;
      },
    };

    try {
      await use(helper);
    } finally {
      server.stop(true);
    }
  },
});

export const serverUrlFixture = createFixture<string>({
  scope: "test",
  deps: ["testServer"],
  setup: async (use, { testServer }) => {
    await use((testServer as TestServerHelper).url);
  },
});

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "*";

export type HttpMockMatcher = string | RegExp | ((request: Request) => boolean);

export interface HttpMockCall {
  method: string;
  url: string;
  request: Request;
  handled: boolean;
}

export type HttpMockResponder = (
  request: Request,
  call: HttpMockCall,
) => Response | undefined | Promise<Response | undefined>;

export interface HttpMockHelper {
  use(
    method: HttpMethod,
    matcher: HttpMockMatcher,
    responder: HttpMockResponder,
  ): void;
  get(matcher: HttpMockMatcher, responder: HttpMockResponder): void;
  post(matcher: HttpMockMatcher, responder: HttpMockResponder): void;
  put(matcher: HttpMockMatcher, responder: HttpMockResponder): void;
  patch(matcher: HttpMockMatcher, responder: HttpMockResponder): void;
  delete(matcher: HttpMockMatcher, responder: HttpMockResponder): void;
  head(matcher: HttpMockMatcher, responder: HttpMockResponder): void;
  options(matcher: HttpMockMatcher, responder: HttpMockResponder): void;
  passthrough(matcher?: HttpMockMatcher): void;
  reset(): void;
  calls(): HttpMockCall[];
  install(target: any): Promise<() => Promise<void>>;
}

interface HttpMockHandler {
  method: HttpMethod;
  matcher: HttpMockMatcher;
  responder?: HttpMockResponder;
}

interface HttpMockState {
  handlers: HttpMockHandler[];
  calls: HttpMockCall[];
}

function createHttpMock(state: HttpMockState): HttpMockHelper {
  const helper: HttpMockHelper = {
    use(method, matcher, responder) {
      state.handlers.unshift({
        method: method.toUpperCase() as HttpMethod,
        matcher,
        responder,
      });
    },
    get(matcher, responder) {
      helper.use("GET", matcher, responder);
    },
    post(matcher, responder) {
      helper.use("POST", matcher, responder);
    },
    put(matcher, responder) {
      helper.use("PUT", matcher, responder);
    },
    patch(matcher, responder) {
      helper.use("PATCH", matcher, responder);
    },
    delete(matcher, responder) {
      helper.use("DELETE", matcher, responder);
    },
    head(matcher, responder) {
      helper.use("HEAD", matcher, responder);
    },
    options(matcher, responder) {
      helper.use("OPTIONS", matcher, responder);
    },
    passthrough(matcher = /.*/) {
      state.handlers.unshift({ method: "*", matcher });
    },
    reset() {
      state.handlers.length = 0;
      state.calls.length = 0;
    },
    calls() {
      return [...state.calls];
    },
    async install(target) {
      return installPlaywrightRoutes(target, state);
    },
  };

  return helper;
}

async function resolveMock(
  request: Request,
  state: HttpMockState,
): Promise<Response | undefined> {
  for (const handler of state.handlers) {
    if (!methodMatches(handler.method, request.method)) continue;
    if (!matcherMatches(handler.matcher, request)) continue;

    const call: HttpMockCall = {
      method: request.method,
      url: request.url,
      request: request.clone(),
      handled: Boolean(handler.responder),
    };
    state.calls.push(call);

    if (!handler.responder) return undefined;
    return await handler.responder(request.clone(), call);
  }
  state.calls.push({
    method: request.method,
    url: request.url,
    request: request.clone(),
    handled: false,
  });
  return undefined;
}

function methodMatches(expected: HttpMethod, actual: string): boolean {
  return expected === "*" || expected === actual.toUpperCase();
}

function matcherMatches(matcher: HttpMockMatcher, request: Request): boolean {
  return matchesFetch(matcher, request);
}

async function installPlaywrightRoutes(
  target: any,
  state: HttpMockState,
): Promise<() => Promise<void>> {
  if (typeof target?.route !== "function") {
    throw new BunTestUtilsError(
      "INVALID_API_USAGE",
      "[@bun-test-utils/server] httpMock.install(target) expects a Playwright BrowserContext or Page",
    );
  }

  const routeHandler = async (route: any) => {
    const pwRequest = route.request();
    const method = pwRequest.method();
    const body = ["GET", "HEAD"].includes(method)
      ? undefined
      : (pwRequest.postDataBuffer?.() ?? pwRequest.postData?.() ?? undefined);
    const request = new Request(pwRequest.url(), {
      method,
      headers: pwRequest.headers(),
      body,
    });
    const response = await resolveMock(request, state);
    if (!response) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: response.status,
      headers: headersObject(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  };

  await target.route("**/*", routeHandler);
  return async () => {
    if (typeof target.unroute === "function") {
      await target.unroute("**/*", routeHandler);
    }
  };
}

function headersObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Fresh mock state plus the `fetch` interceptor that drives it. Shared by the
 * `httpMock` fixture here and by `browserHttpMock` in the browser pack, which
 * layers Playwright routes over the same helper.
 */
export function installHttpMock(): {
  helper: HttpMockHelper;
  uninstall: () => void;
} {
  const state: HttpMockState = { handlers: [], calls: [] };
  const helper = createHttpMock(state);
  const uninstall = installFetchInterceptor((request) =>
    resolveMock(request, state),
  );
  return { helper, uninstall };
}

export const httpMockFixture = createFixture<HttpMockHelper>({
  scope: "test",
  setup: async (use) => {
    const { helper, uninstall } = installHttpMock();
    try {
      await use(helper);
    } finally {
      uninstall();
    }
  },
});

export const serverFixtures: FixtureMap = {
  testServer: testServerFixture,
  serverUrl: serverUrlFixture,
  httpMock: httpMockFixture,
};

/** Playwright-style test preconfigured with server fixtures. */
export const test = baseTest.extend(serverFixtures);

export default serverFixtures;

/** Internal error re-exports for workspace-local tests and adapters. */
/** Re-exported so a suite can compose from a single import. */
export {
  BunTestUtilsError,
  describe,
  expect,
} from "@bun-test-utils/core";

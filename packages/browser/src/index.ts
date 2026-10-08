import { Buffer } from "node:buffer";
import {
  BunTestUtilsError,
  test as baseTest,
  createFixture,
  type FixtureMap,
  installFetchInterceptor,
  MissingOptionalDependencyError,
  matchesFetch,
} from "@bun-test-utils/core";
import type { Server } from "bun";

interface BrowserLike {
  newContext(): Promise<BrowserContextLike>;
  close(): Promise<void>;
  isConnected(): boolean;
}
interface BrowserContextLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}
interface PageLike {
  close(): Promise<void>;
  goto(url: string): Promise<unknown>;
  setContent(html: string): Promise<unknown>;
  click(selector: string): Promise<unknown>;
  fill(selector: string, text: string): Promise<unknown>;
  textContent(selector: string): Promise<string | null>;
  content(): Promise<string>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
}

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

const PLAYWRIGHT_MODULE = "playwright";
const HAPPY_DOM_MODULE = "happy-dom";

async function loadPlaywright(): Promise<{
  chromium?: BrowserTypeLike;
  default?: { chromium?: BrowserTypeLike };
}> {
  try {
    return await import(PLAYWRIGHT_MODULE);
  } catch {
    throw new MissingOptionalDependencyError(
      "playwright",
      "bun add -d playwright",
      "[@bun-test-utils/browser] 'playwright' is required for browser fixtures. Install via 'bun add -d playwright'.",
    );
  }
}

interface BrowserTypeLike {
  launch(options: { headless: boolean }): Promise<BrowserLike>;
}

function chromiumFrom(
  playwright: Awaited<ReturnType<typeof loadPlaywright>>,
): BrowserTypeLike {
  const chromium = playwright.chromium || playwright.default?.chromium;
  if (!chromium) {
    throw new MissingOptionalDependencyError(
      "chromium",
      "bunx playwright install chromium",
      "[@bun-test-utils/browser] Failed to locate chromium in playwright.",
    );
  }
  return chromium;
}

export const browserFixture = createFixture<BrowserLike>({
  scope: "session",
  setup: async (use) => {
    const chromium = chromiumFrom(await loadPlaywright());
    const browser = await chromium.launch({
      headless: true,
    });
    try {
      await use(browser);
    } finally {
      await browser.close();
    }
  },
});

export const browserContextFixture = createFixture<BrowserContextLike>({
  scope: "test",
  deps: ["browser"],
  setup: async (use, { browser }) => {
    const context = await browser.newContext();
    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
});

export const browserPageFixture = createFixture<PageLike>({
  scope: "test",
  deps: ["browserContext"],
  setup: async (use, { browserContext }) => {
    const page = await browserContext.newPage();
    try {
      await use(page);
    } finally {
      await page.close();
    }
  },
});

export type WebEnvironment = "dom" | "browser";

export interface WebPageHelper {
  /** The concrete backend chosen for this test. */
  mode: WebEnvironment;
  /** The underlying happy-dom window or Playwright Page. */
  raw: any;
  goto(url: string): Promise<void>;
  setContent(html: string): Promise<void>;
  mount(html: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  textContent(selector: string): Promise<string | null>;
  html(): Promise<string>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
}

function webEnvironment(): WebEnvironment {
  const value = process.env.BUN_TEST_UTILS_WEB_ENV?.toLowerCase();
  if (value === "browser" || value === "playwright") return "browser";
  return "dom";
}

async function createDomWebPage(): Promise<{
  helper: WebPageHelper;
  close: () => Promise<void>;
}> {
  let GlobalWindowCtor: any;
  try {
    ({ GlobalWindow: GlobalWindowCtor } = await import(HAPPY_DOM_MODULE));
  } catch {
    throw new MissingOptionalDependencyError(
      "happy-dom",
      "bun add -d happy-dom",
      "[@bun-test-utils/browser] webPage in DOM mode requires 'happy-dom'. Install via 'bun add -d happy-dom'.",
    );
  }

  const win = new GlobalWindowCtor({ url: "http://localhost" });
  const doc = win.document as Document;

  const helper: WebPageHelper = {
    mode: "dom",
    raw: win,
    async goto(url) {
      const response = await fetch(url);
      doc.body.innerHTML = await response.text();
    },
    async setContent(html) {
      doc.body.innerHTML = html;
    },
    async mount(html) {
      doc.body.innerHTML = html;
    },
    async click(selector) {
      const el = doc.querySelector<HTMLElement>(selector);
      if (!el) throw missingElement(selector, "webPage.click");
      el.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    },
    async type(selector, text) {
      const el = doc.querySelector<HTMLInputElement>(selector);
      if (!el) throw missingElement(selector, "webPage.type");
      el.value = text;
      el.dispatchEvent(new win.Event("input", { bubbles: true }));
      el.dispatchEvent(new win.Event("change", { bubbles: true }));
    },
    async textContent(selector) {
      return doc.querySelector(selector)?.textContent ?? null;
    },
    async html() {
      return doc.body.innerHTML;
    },
    async evaluate(fn) {
      return await fn.call(win);
    },
  };

  return {
    helper,
    close: async () => {
      await win.happyDOM.abort();
      await win.happyDOM.close();
    },
  };
}

async function createBrowserWebPage(): Promise<{
  helper: WebPageHelper;
  close: () => Promise<void>;
}> {
  const chromium = chromiumFrom(await loadPlaywright());
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const helper: WebPageHelper = {
    mode: "browser",
    raw: page,
    async goto(url) {
      await page.goto(url);
    },
    async setContent(html) {
      await page.setContent(html);
    },
    async mount(html) {
      await page.setContent(html);
    },
    async click(selector) {
      await page.click(selector);
    },
    async type(selector, text) {
      await page.fill(selector, text);
    },
    async textContent(selector) {
      return await page.textContent(selector);
    },
    async html() {
      return await page.content();
    },
    async evaluate(fn) {
      return await page.evaluate(fn);
    },
  };

  return {
    helper,
    close: async () => {
      await page.close();
      await context.close();
      await browser.close();
    },
  };
}

function missingElement(selector: string, api: string): BunTestUtilsError {
  return new BunTestUtilsError(
    "INVALID_API_USAGE",
    `[@bun-test-utils/browser] ${api} could not find element "${selector}"`,
    { details: { selector } },
  );
}

export const webPageFixture = createFixture<WebPageHelper>({
  scope: "test",
  setup: async (use) => {
    const page =
      webEnvironment() === "browser"
        ? await createBrowserWebPage()
        : await createDomWebPage();
    try {
      await use(page.helper);
    } finally {
      await page.close();
    }
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
      "[@bun-test-utils/browser] httpMock.install(target) expects a Playwright BrowserContext or Page",
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

export const httpMockFixture = createFixture<HttpMockHelper>({
  scope: "test",
  setup: async (use) => {
    const state: HttpMockState = { handlers: [], calls: [] };
    const httpMock = createHttpMock(state);
    const uninstall = installFetchInterceptor((request) =>
      resolveMock(request, state),
    );

    try {
      await use(httpMock);
    } finally {
      uninstall();
    }
  },
});

export const browserHttpMockFixture = createFixture<HttpMockHelper>({
  scope: "test",
  deps: ["httpMock", "browserContext"],
  setup: async (use, { httpMock, browserContext }) => {
    const uninstall = await (httpMock as HttpMockHelper).install(
      browserContext,
    );
    try {
      await use(httpMock as HttpMockHelper);
    } finally {
      await uninstall();
    }
  },
});

export const browserFixtures: FixtureMap = {
  testServer: testServerFixture,
  serverUrl: serverUrlFixture,
  browser: browserFixture,
  browserContext: browserContextFixture,
  browserPage: browserPageFixture,
  webPage: webPageFixture,
  httpMock: httpMockFixture,
  browserHttpMock: browserHttpMockFixture,
};

/** Playwright-style test preconfigured with browser fixtures. */
export const test = baseTest.extend(browserFixtures);

export default browserFixtures;

/** Internal error re-exports for workspace-local tests and adapters. */
/** Re-exported so a suite can compose from a single import. */
export {
  BunTestUtilsError,
  describe,
  expect,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";

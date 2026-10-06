import type { FixtureDef, FixtureMap } from "@bun-test-utils/core";
import type { Server } from "bun";

export interface TestServerHelper {
  url: string;
  port: number;
  server: Server<any>;
  /** Sets or updates the request handler function. */
  handle(fn: (req: Request) => Response | Promise<Response>): void;
}

export const testServerFixture: FixtureDef<TestServerHelper> = {
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
};

export const serverUrlFixture: FixtureDef<string> = {
  scope: "test",
  deps: ["testServer"],
  setup: async (use, { testServer }) => {
    await use((testServer as TestServerHelper).url);
  },
};

const PLAYWRIGHT_MODULE = "playwright";

export const browserFixture: FixtureDef<any> = {
  scope: "session",
  setup: async (use) => {
    let playwright: any;
    try {
      playwright = await import(PLAYWRIGHT_MODULE);
    } catch {
      throw new Error(
        "[@bun-test-utils/browser] 'playwright' is required for browser fixtures. Install via 'bun add -d playwright'.",
      );
    }
    const chromium = playwright.chromium || playwright.default?.chromium;
    if (!chromium) {
      throw new Error(
        "[@bun-test-utils/browser] Failed to locate chromium in playwright.",
      );
    }
    const browser = await chromium.launch({
      headless: true,
    });
    try {
      await use(browser);
    } finally {
      await browser.close();
    }
  },
};

export const browserContextFixture: FixtureDef<any> = {
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
};

export const browserPageFixture: FixtureDef<any> = {
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
};

export const browserFixtures: FixtureMap = {
  testServer: testServerFixture,
  serverUrl: serverUrlFixture,
  browser: browserFixture,
  browserContext: browserContextFixture,
  browserPage: browserPageFixture,
};

export default browserFixtures;

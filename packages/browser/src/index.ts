import {
  BunTestUtilsError,
  test as baseTest,
  createFixture,
  type FixtureMap,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";
import { type HttpMockHelper, installHttpMock } from "@bun-test-utils/server";

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

const PLAYWRIGHT_MODULE = "playwright";
const HAPPY_DOM_MODULE = "happy-dom";

/**
 * Structural surface of a happy-dom `GlobalWindow` the DOM web-page backend
 * uses — the package-local adapter interface standing in for the optional
 * peer's types (audit finding 2). Members beyond this surface are off the
 * supported path on purpose.
 */
interface DomWindowLike {
  document: Document;
  MouseEvent: new (type: string, init?: MouseEventInit) => MouseEvent;
  Event: new (type: string, init?: EventInit) => Event;
  happyDOM: { abort(): Promise<void>; close(): Promise<void> };
}

/** Constructor shape `import("happy-dom")` must supply, structurally. */
interface DomWindowCtorLike {
  new (options?: { url?: string }): DomWindowLike;
}

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
  launch(options: {
    headless: boolean;
    channel?: string;
  }): Promise<BrowserLike>;
}

/**
 * Playwright resolves a default headless chromium launch to the separate
 * `chromium-headless-shell` build, not to the full `chromium` build that
 * `chromium.executablePath()` reports. An environment that installed only the
 * full build therefore passes an availability check and then fails at launch.
 */
const MISSING_EXECUTABLE = /executable doesn't exist/i;

/**
 * Launches headless chromium, falling back to the full `chromium` build (driven
 * in its new headless mode via `channel: "chromium"`) when the headless shell is
 * not installed. Installations that do have the shell keep using it unchanged;
 * any other launch failure is rethrown untouched.
 */
async function launchHeadlessChromium(
  chromium: BrowserTypeLike,
): Promise<BrowserLike> {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (
      !MISSING_EXECUTABLE.test(String((error as Error | undefined)?.message))
    ) {
      throw error;
    }
    return chromium.launch({ headless: true, channel: "chromium" });
  }
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
    let browser: BrowserLike;
    try {
      browser = await launchHeadlessChromium(chromium);
    } catch (cause) {
      const message =
        "[@bun-test-utils/browser] No browser is available — both the headless shell and the full chromium build failed to launch. " +
        "Run 'bun run install-browsers' to install chromium and firefox via the standard Playwright installer.";
      console.error(message);
      throw new BunTestUtilsError("FIXTURE_SETUP_FAILED", message, { cause });
    }
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
  /** The underlying happy-dom window (DOM mode) or Playwright Page (browser mode). */
  raw: DomWindowLike | PageLike;
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
  let GlobalWindowCtor: DomWindowCtorLike;
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
  const doc = win.document;

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
  let browser: BrowserLike;
  try {
    browser = await launchHeadlessChromium(chromium);
  } catch (cause) {
    const message =
      "[@bun-test-utils/browser] No browser is available — both the headless shell and the full chromium build failed to launch. " +
      "Run 'bun run install-browsers' to install chromium and firefox via the standard Playwright installer.";
    console.error(message);
    throw new BunTestUtilsError("FIXTURE_SETUP_FAILED", message, { cause });
  }
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

/**
 * Adapts the `httpMock` handler API from `@bun-test-utils/server` onto a
 * Playwright browser context: the same helpers fulfil requests the page makes,
 * while the fetch interceptor stays installed for Node-side requests.
 */
export const browserHttpMockFixture = createFixture<HttpMockHelper>({
  scope: "test",
  deps: ["browserContext"],
  setup: async (use, { browserContext }) => {
    const { helper, uninstall } = installHttpMock();
    const uninstallRoutes = await helper.install(browserContext);
    try {
      await use(helper);
    } finally {
      await uninstallRoutes();
      uninstall();
    }
  },
});

export const browserFixtures: FixtureMap = {
  browser: browserFixture,
  browserContext: browserContextFixture,
  browserPage: browserPageFixture,
  webPage: webPageFixture,
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

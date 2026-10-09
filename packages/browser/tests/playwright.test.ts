/**
 * Real-browser coverage for the Playwright fixtures (spec 0011 R3–R5),
 * composed the way a consumer composes them.
 *
 * These tests need `playwright install chromium` to have run. Without the
 * downloaded binaries they skip instead of failing: installing none of the
 * optional peers must still leave the suite green for library contributors.
 * Error-path behaviour for a missing `playwright` package is pinned by
 * tests/playwright-missing-peer.test.ts, which runs unconditionally.
 *
 * Having the binary is not the whole story: it also needs its system shared
 * libraries, which this repository sources from the pixi `browser` environment.
 * `usePixiBrowserLibraries()` puts them on the loader path so a plain
 * `bun test` behaves like `pixi run -e browser bun test`; see
 * tests/support/browser-libs.ts.
 *
 * Scope is the subject here, and the engine is what makes it visible:
 * `browser` is session-scoped, so consecutive tests receive the *same*
 * instance, while `browserContext` and `browserPage` are test-scoped and are
 * rebuilt and torn down around every test. Isolation is therefore asserted
 * *across* tests rather than by opening two contexts inside one — which is
 * exactly how a consumer experiences it.
 */

import { test as bunTest } from "bun:test";
import { testServerFixture } from "@bun-test-utils/server";
import { chromium } from "playwright";
import {
  browserContextFixture,
  browserFixture,
  browserPageFixture,
  test as browserTest,
  describe,
  expect,
} from "@/index.ts";
import { usePixiBrowserLibraries } from "./support/browser-libs.ts";

// Must happen before any fixture spawns a browser; see support/browser-libs.ts.
usePixiBrowserLibraries();

/**
 * These tests serve real pages to a real browser, so the suite composes the
 * server pack's ephemeral `testServer` (ADR 0031) — composition in the test
 * file, not a re-export from the browser pack.
 */
const test = browserTest.extend({ testServer: testServerFixture });

/**
 * Can a browser actually be launched here?
 *
 * `existsSync(chromium.executablePath())` — the previous check — is not a safe
 * proxy, because Playwright ≥ 1.49 reports the *full* chromium build from
 * `executablePath()` while a default `launch()` resolves to the separate
 * `chromium-headless-shell` build. The two disagree in both directions: the
 * check passes for a build that is never launched (and the launch then fails on
 * the missing shell), and it fails for an installation carrying only the
 * headless shell — which is exactly what CI installs, so the suite silently
 * skipped the coverage CI claims to run.
 *
 * Launching once answers the real question, including the case the binaries
 * exist but their system libraries do not. Mirrors `launchHeadlessChromium` in
 * src/index.ts: default build first, then the full build.
 */
const chromiumLaunchable = await (async () => {
  for (const options of [
    { headless: true },
    { headless: true, channel: "chromium" },
  ]) {
    try {
      const browser = await chromium.launch(options);
      await browser.close();
      return true;
    } catch {
      // Not this build; the next one may be installed.
    }
  }
  return false;
})();

const PAGE_HTML = `<!doctype html><html><body>
  <h1>counter</h1>
  <button id="inc" onclick="count.textContent = Number(count.textContent) + 1">++</button>
  <span id="count">0</span>
  </body></html>`;

/** Breadcrumbs let a later test observe the previous test's teardown. */
const breadcrumbs: {
  browser?: any;
  context?: any;
  page?: any;
} = {};

describe.skipIf(!chromiumLaunchable)(
  "@bun-test-utils/browser — playwright fixtures",
  () => {
    test("declares the scopes the fixtures are documented with", async () => {
      expect(browserFixture.scope).toBe("session");
      expect(browserContextFixture.scope).toBe("test");
      expect(browserPageFixture.scope).toBe("test");
    });

    test("injects a connected, headless browser", async ({ browser }) => {
      breadcrumbs.browser = browser;
      expect(browser.isConnected()).toBe(true);
      expect(typeof browser.newContext).toBe("function");
    });

    test("reuses the same session-scoped browser in the next test", async ({
      browser,
    }) => {
      // Session scope: not rebuilt between tests, and still connected.
      expect(browser).toBe(breadcrumbs.browser);
      expect(browser.isConnected()).toBe(true);
    });

    test("a test-scoped context owns its cookies and storage", async ({
      browser,
      browserContext,
      testServer,
    }) => {
      expect(browserContext).not.toBe(breadcrumbs.context);
      breadcrumbs.context = browserContext;
      // The context was created on the session browser.
      expect(browser.isConnected()).toBe(true);

      testServer.handle(
        () =>
          new Response(PAGE_HTML, {
            headers: { "content-type": "text/html" },
          }),
      );

      const page = await browserContext.newPage();
      await page.goto(testServer.url);
      await browserContext.addCookies([
        { name: "session", value: "abc", url: testServer.url },
      ]);
      await page.evaluate(() =>
        localStorage.setItem("probe", "from-context-a"),
      );
      await page.reload();
      expect(await page.evaluate(() => localStorage.getItem("probe"))).toBe(
        "from-context-a",
      );
      await page.close();
    });

    test("the next test gets a fresh context with none of that state", async ({
      browserContext,
      testServer,
    }) => {
      // A different context object…
      expect(browserContext).not.toBe(breadcrumbs.context);
      // …and the previous one was closed by its teardown.
      await expect(breadcrumbs.context.newPage()).rejects.toThrow();

      expect((await browserContext.cookies()).length).toBe(0);

      testServer.handle(
        () =>
          new Response(PAGE_HTML, {
            headers: { "content-type": "text/html" },
          }),
      );
      const page = await browserContext.newPage();
      await page.goto(testServer.url);
      expect(await page.evaluate(() => localStorage.getItem("probe"))).toBe(
        null,
      );
      await page.close();
    });

    test("browserPage navigates and interacts with a page served by testServer", async ({
      browserContext,
      browserPage,
      testServer,
    }) => {
      breadcrumbs.context = browserContext;
      breadcrumbs.page = browserPage;

      testServer.handle(
        () =>
          new Response(PAGE_HTML, {
            headers: { "content-type": "text/html" },
          }),
      );

      await browserPage.goto(testServer.url);
      expect(await browserPage.textContent("h1")).toBe("counter");

      await browserPage.click("#inc");
      await browserPage.click("#inc");
      expect(await browserPage.textContent("#count")).toBe("2");
    });

    test("engine teardown closed the previous test's page and context", async () => {
      expect(breadcrumbs.page.isClosed()).toBe(true);
      expect(breadcrumbs.context.pages().includes(breadcrumbs.page)).toBe(
        false,
      );
    });
  },
);

/**
 * The session-scoped browser is closed when the *session* ends, not when a
 * test ends, so "closes on teardown" cannot be observed from inside a test
 * that the same session is still running. This one case therefore drives the
 * fixture directly — the only way to bring its teardown forward — while
 * every behaviour above goes through the engine.
 */
describe.skipIf(!chromiumLaunchable)(
  "@bun-test-utils/browser — session teardown",
  () => {
    bunTest("session-scoped browser closes when its scope ends", async () => {
      let captured: any;
      await browserFixture.setup(
        async (browser) => {
          captured = browser;
          expect(browser.isConnected()).toBe(true);
        },
        { testFile: import.meta.path },
      );
      expect(captured.isConnected()).toBe(false);
    });
  },
);

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import {
  browserContextFixture,
  browserFixture,
  browserPageFixture,
  testServerFixture,
} from "@/index.ts";

/**
 * Real-browser coverage for the Playwright fixtures (spec 0011 R3–R5).
 *
 * These tests need `playwright install chromium` to have run. Without the
 * downloaded binaries they skip instead of failing: installing none of the
 * optional peers must still leave the suite green for library contributors.
 * Error-path behaviour for a missing `playwright` package is pinned by
 * tests/playwright-missing-peer.test.ts, which runs unconditionally.
 */
const chromiumAvailable = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

describe.skipIf(!chromiumAvailable)(
  "@bun-test-utils/browser — playwright fixtures",
  () => {
    test("session-scoped browser launches headless and closes on teardown", async () => {
      expect(browserFixture.scope).toBe("session");

      let captured: any;
      await browserFixture.setup(
        async (browser) => {
          captured = browser;
          expect(browser.isConnected()).toBe(true);
          expect(typeof browser.newContext).toBe("function");
        },
        { testFile: import.meta.path },
      );

      expect(captured.isConnected()).toBe(false);
    });

    test("test-scoped contexts on one browser isolate cookies and storage", async () => {
      expect(browserContextFixture.scope).toBe("test");
      expect(browserPageFixture.scope).toBe("test");

      const ISOLATION_HTML = `<!doctype html><html><body><h1>isolated</h1></body></html>`;

      let capturedContext: any;
      await testServerFixture.setup(
        async (testServer) => {
          testServer.handle(
            () =>
              new Response(ISOLATION_HTML, {
                headers: { "content-type": "text/html" },
              }),
          );

          await browserFixture.setup(
            async (browser) => {
              // First "test": its context owns a cookie and a storage entry
              // that survives a reload inside the same context.
              await browserContextFixture.setup(
                async (firstContext) => {
                  capturedContext = firstContext;
                  const page = await firstContext.newPage();
                  await page.goto(testServer.url);
                  await firstContext.addCookies([
                    { name: "session", value: "abc", url: testServer.url },
                  ]);
                  await page.evaluate(() =>
                    localStorage.setItem("probe", "from-context-a"),
                  );
                  await page.reload();
                  expect(
                    await page.evaluate(() => localStorage.getItem("probe")),
                  ).toBe("from-context-a");
                  await page.close();
                },
                { browser, testFile: import.meta.path },
              );

              // Second "test": same origin, same session browser, fresh state.
              await browserContextFixture.setup(
                async (secondContext) => {
                  expect((await secondContext.cookies()).length).toBe(0);

                  const page = await secondContext.newPage();
                  await page.goto(testServer.url);
                  expect(
                    await page.evaluate(() => localStorage.getItem("probe")),
                  ).toBe(null);
                  await page.close();
                },
                { browser, testFile: import.meta.path },
              );
            },
            { testFile: import.meta.path },
          );
        },
        { testFile: import.meta.path },
      );

      // The first context was closed by its teardown even while the browser lived on.
      await expect(capturedContext.newPage()).rejects.toThrow();
    });

    test("browserPage navigates and interacts with a page served by testServer", async () => {
      const COUNTER_HTML = `<!doctype html><html><body>
      <h1>counter</h1>
      <button id="inc" onclick="count.textContent = Number(count.textContent) + 1">++</button>
      <span id="count">0</span>
      </body></html>`;

      await testServerFixture.setup(
        async (testServer) => {
          testServer.handle(
            () =>
              new Response(COUNTER_HTML, {
                headers: { "content-type": "text/html" },
              }),
          );

          await browserFixture.setup(
            async (browser) => {
              await browserContextFixture.setup(
                async (browserContext) => {
                  let capturedPage: any;
                  await browserPageFixture.setup(
                    async (page) => {
                      capturedPage = page;
                      await page.goto(testServer.url);
                      expect(await page.textContent("h1")).toBe("counter");

                      await page.click("#inc");
                      await page.click("#inc");
                      expect(await page.textContent("#count")).toBe("2");
                    },
                    { browserContext, testFile: import.meta.path },
                  );

                  // The page fixture closed its page when the test finished.
                  expect(capturedPage.isClosed()).toBe(true);
                  expect(browserContext.pages().includes(capturedPage)).toBe(
                    false,
                  );
                },
                { browser, testFile: import.meta.path },
              );
            },
            { testFile: import.meta.path },
          );
        },
        { testFile: import.meta.path },
      );
    });
  },
);

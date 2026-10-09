/**
 * The browser-side fixtures, composed the way a consumer composes them.
 *
 * `webEnv` is a locally declared fixture made a dependency of `webPage`, which
 * is how a test selects the happy-dom backend declaratively: the engine sets
 * the environment variable before `webPage` reads it and LIFO teardown
 * restores it afterwards.
 *
 * Teardown runs after the body returns, so "the environment variable really
 * was restored" is asserted by the test that follows. The server-side fixtures
 * (testServer, serverUrl, httpMock) moved to @bun-test-utils/server with their
 * own suite (ADR 0031).
 */

import { describe, expect, test, webPageFixture } from "@/index.ts";

/**
 * Selects the happy-dom backend for `webPage` by dependency ordering, and
 * restores the previous value when the engine tears it down.
 */
const domWebPageTest = test.extend({
  webEnv: {
    setup: async (use: (value: string) => unknown) => {
      const previous = process.env.BUN_TEST_UTILS_WEB_ENV;
      process.env.BUN_TEST_UTILS_WEB_ENV = "dom";
      try {
        await use("dom");
      } finally {
        if (previous === undefined) delete process.env.BUN_TEST_UTILS_WEB_ENV;
        else process.env.BUN_TEST_UTILS_WEB_ENV = previous;
      }
    },
  },
  webPage: { ...webPageFixture, deps: ["webEnv"] },
});

describe("@bun-test-utils/browser", () => {
  domWebPageTest(
    "webPage defaults to the happy-dom backend",
    async ({ webPage }) => {
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
  );

  test("engine teardown restored the web-environment variable", async () => {
    expect(process.env.BUN_TEST_UTILS_WEB_ENV).toBeUndefined();
  });
});

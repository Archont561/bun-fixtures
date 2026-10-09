/**
 * Headless Firefox launch proof (task_073) at the Playwright level.
 *
 * Scope: the `browser` fixture stays Chromium-only (spec 0011 R3 narrowed per
 * ADR 0030); what this pins is that a Firefox Playwright can drive exists in
 * this environment and can render a real page. It is the proof the deferral
 * decision rests on, so it lives beside the chromium suite, not in the
 * fixture.
 *
 * The binary comes from `bun run install-browsers` (task_075), which runs the
 * standard Playwright installer (`bunx playwright install chromium firefox`)
 * pinned to the workspace's playwright version. The installer downloads the
 * firefox build whose revision the checked-in Playwright pins in its
 * browsers.json, into the standard global cache (~/.cache/ms-playwright or
 * PLAYWRIGHT_BROWSERS_PATH). The system libraries come from the pixi `browser`
 * environment — Firefox dlopens libmozgtk.so, which links libgtk-3.so.0; that
 * runtime edge is why gtk3 survives the task_072 prune even though no binary
 * links it directly.
 *
 * This suite keeps its launch-probe skip: CI installs no firefox (only
 * chromium-headless-shell), so firefox coverage is opt-in for contributors
 * and this sandbox. No launchable firefox (no binary, or no libraries) skips;
 * everything else is a failure.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { firefox } from "playwright";
import { usePixiBrowserLibraries } from "./support/browser-libs.ts";

// Must happen before any browser is spawned; see support/browser-libs.ts.
usePixiBrowserLibraries();

const firefoxLaunchable = await (async () => {
  try {
    const browser = await firefox.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!firefoxLaunchable)(
  "@bun-test-utils/browser — headless firefox",
  () => {
    test("launches headless and renders a page served by Bun.serve", async () => {
      const server = Bun.serve({
        port: 0,
        fetch: () =>
          new Response(
            `<!doctype html><html><head><title>firefox launch proof</title></head>` +
              `<body><span id="v">7</span></body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8" } },
          ),
      });
      const { port } = server;
      if (port === undefined) {
        server.stop(true);
        throw new Error("Bun.serve did not bind a port");
      }
      const browser = await firefox.launch({ headless: true });
      try {
        const page = await browser.newPage();
        const response = await page.goto(`http://127.0.0.1:${port}/`, {
          waitUntil: "load",
        });
        expect(response?.status()).toBe(200);
        expect(await page.title()).toBe("firefox launch proof");
        expect(await page.locator("#v").textContent()).toBe("7");
      } finally {
        await browser.close();
        server.stop(true);
      }
    });

    test("the installed build is the revision Playwright pins", async () => {
      // executablePath() is computed from Playwright's own registry — the
      // browsers.json revision — so the file existing at that exact path is
      // the equality check between the restored build and the pinned one.
      // The skip condition proves the browser launches; this proves from where.
      expect(existsSync(firefox.executablePath())).toBe(true);
      expect(firefox.executablePath()).toMatch(
        /firefox-\d+[/\\]firefox[/\\]firefox$/,
      );
    });
  },
);

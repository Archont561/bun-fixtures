/**
 * Headed Chromium on a private Xvfb display, from the pixi `browser` environment.
 *
 * Headed runs need an X server. The environment ships one (`xorg-xvfb-server`),
 * started by `scripts/xvfb.sh`, which also applies the repairs a restored bundle
 * needs before Xvfb will start (see scripts/browser-activate.sh). This test
 * starts that launcher with `-displayfd 1`, so the X server picks a free display
 * and cannot collide with a `:99` a developer already runs, then launches
 * Chromium with `headless: false` on it.
 *
 * It skips where there is no environment to test (CI, a plain checkout, macOS):
 * the same reasoning as playwright.test.ts. Where the environment is present, a
 * broken Xvfb or a headed Chromium that cannot render is a failure, not a skip.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { usePixiBrowserLibraries } from "./support/browser-libs.ts";

// Same loader-path wiring as playwright.test.ts; the Xvfb launcher sets its own.
usePixiBrowserLibraries();

const repoRoot = resolve(import.meta.dir, "..", "..", "..");
const browserEnv = join(repoRoot, ".pixi", "envs", "browser");
const launcher = join(repoRoot, "scripts", "xvfb.sh");

const headedEnvironmentPresent =
  process.platform === "linux" && existsSync(join(browserEnv, "bin", "Xvfb"));

type XvfbProcess = ReturnType<typeof Bun.spawn>;

/**
 * Xvfb writes the display number it chose, and nothing else, to stdout once it
 * accepts clients. Fails with the server log if that never happens.
 */
async function readDisplayNumber(
  xvfb: XvfbProcess,
  logPath: string,
): Promise<string> {
  const reader = (xvfb.stdout as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + 20_000;
  let text = "";
  while (!text.includes("\n")) {
    const remaining = Math.max(deadline - Date.now(), 0);
    const chunk = await Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((resolveTimeout) =>
        setTimeout(
          () => resolveTimeout({ done: true, value: undefined }),
          remaining,
        ),
      ),
    ]);
    if (chunk.done) {
      throw new Error(
        `Xvfb did not report a display number.\n--- xvfb.log ---\n${readFileSync(logPath, "utf8")}`,
      );
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text.trim();
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(view.getUint32(0)).toBe(0x89504e47); // "\x89PNG"
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe.skipIf(!headedEnvironmentPresent)(
  "headed Chromium on a private Xvfb display",
  () => {
    test("Xvfb stays up while a headed Chromium renders a page on it", async () => {
      const workDir = mkdtempSync(join(tmpdir(), "headed-chromium-"));
      const logPath = join(workDir, "xvfb.log");
      const xvfb = Bun.spawn(
        [
          "sh",
          launcher,
          "-displayfd",
          "1",
          "-screen",
          "0",
          "1280x720x24",
          "-nolisten",
          "tcp",
        ],
        { stdout: "pipe", stderr: Bun.file(logPath) },
      );

      const xvfbLog = () => readFileSync(logPath, "utf8");
      let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
      try {
        const display = `:${await readDisplayNumber(xvfb, logPath)}`;

        browser = await chromium.launch({
          headless: false,
          env: { ...process.env, DISPLAY: display },
        });
        const page = await browser.newPage({
          viewport: { width: 800, height: 600 },
        });
        await page.setContent(
          "<!doctype html><title>headed</title><h1>hello headed</h1>",
        );
        // On a bare X server, Chromium produces its first frame just after the
        // page loads, and a screenshot requested before that fails with "Unable
        // to capture screenshot" (10 of 20 runs in a probe). Two
        // animation frames mean a frame has been painted.
        await page.evaluate(
          () =>
            new Promise<void>((done) =>
              requestAnimationFrame(() => requestAnimationFrame(() => done())),
            ),
        );

        expect(await page.textContent("h1")).toBe("hello headed");
        // A headless launch identifies itself in the user agent; a headed one does not.
        expect(await page.evaluate(() => navigator.userAgent)).not.toContain(
          "HeadlessChrome",
        );
        // The screenshot is rasterised by the browser at the viewport size.
        expect(pngSize(await page.screenshot())).toEqual({
          width: 800,
          height: 600,
        });

        await browser.close();
        browser = undefined;

        // The X server must outlive the client that used it.
        if (xvfb.exitCode !== null) {
          throw new Error(
            `Xvfb exited during the browser session (code ${xvfb.exitCode}).\n--- xvfb.log ---\n${xvfbLog()}`,
          );
        }
      } finally {
        // Close the browser and stop the server even if one of them fails to close.
        await browser?.close().catch(() => {});
        xvfb.kill();
        await xvfb.exited;
        rmSync(workDir, { recursive: true, force: true });
      }
    }, 60_000);
  },
);

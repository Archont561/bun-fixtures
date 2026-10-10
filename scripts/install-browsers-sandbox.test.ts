import { describe, expect, test } from "bun:test";
import {
  browserCacheRoot,
  pinnedRevisions,
  playwrightLayout,
  SPARTICUZ_VERSION,
  shellQuote,
  wrapperScript,
} from "./install-browsers-sandbox.ts";

describe("sandbox browser install — pure wiring", () => {
  test("the cache root honours PLAYWRIGHT_BROWSERS_PATH and defaults to ~/.cache/ms-playwright", () => {
    expect(browserCacheRoot({ PLAYWRIGHT_BROWSERS_PATH: "/x/browsers" })).toBe(
      "/x/browsers",
    );
    expect(browserCacheRoot({})).toMatch(/\.cache\/ms-playwright$/);
  });

  test("the Playwright layout places the full build and the headless shell at their pinned revisions", () => {
    const layout = playwrightLayout({
      chromium: "1243",
      "chromium-headless-shell": "1243",
    });
    expect(layout).toEqual([
      {
        dir: "chromium_headless_shell-1243",
        binary: "chrome-headless-shell-linux64/chrome-headless-shell",
      },
      { dir: "chromium-1243", binary: "chrome-linux64/chrome" },
    ]);
  });

  test("the pinned revisions come from the workspace's own Playwright install", () => {
    const revisions = pinnedRevisions();
    expect(revisions.chromium).toMatch(/^\d+$/);
    expect(revisions["chromium-headless-shell"]).toMatch(/^\d+$/);
  });

  test("the wrapper sets the library and font paths before exec'ing the binary, quoting each path", () => {
    const script = wrapperScript(
      "/tmp/chromium",
      "/tmp/al2023/lib",
      "/tmp/fonts",
    );
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).toContain("export LD_LIBRARY_PATH='/tmp/al2023/lib'");
    expect(script).toContain("export FONTCONFIG_PATH='/tmp/fonts'");
    expect(script).toContain("exec '/tmp/chromium' \"$@\"");
  });

  test("shellQuote escapes single quotes so a path cannot break the wrapper", () => {
    expect(shellQuote("/tmp/it's")).toBe("'/tmp/it'\\''s'");
  });

  test("the pinned sparticuz version is an exact version, not a range", () => {
    expect(SPARTICUZ_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

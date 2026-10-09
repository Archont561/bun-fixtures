import { describe, expect, test } from "bun:test";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Coverage for the headless-shell fallback in the browser fixtures.
 *
 * Playwright resolves a default `chromium.launch({ headless: true })` to the
 * separate `chromium-headless-shell` build, while `chromium.executablePath()`
 * reports the full `chromium` build. An installation carrying only the full
 * build — `bun run install-browsers --no-shell` — therefore looks complete
 * and then fails at the default launch. The fixtures retry once against the
 * full build via `channel: "chromium"`; installs that do have the shell keep
 * using it.
 *
 * As in playwright-missing-peer.test.ts, this drives the BUILT public root
 * artifact from a temp directory outside the workspace with a stub `playwright`
 * package: bun's mock cache cannot reliably override a specifier the same
 * process already loaded from the monorepo, and the stub has to record what the
 * fixture asked for. Skipped when dist/plugin.js is absent (run `bun run
 * build` first; Turborepo's `test` task already depends on `^build`).
 */

const distEntry = join(
  import.meta.dir,
  "..",
  "..",
  "bun-test-utils",
  "dist",
  "plugin.js",
);
const distBuilt = existsSync(distEntry);

type LaunchMode = "missing-shell" | "shell-present";

/**
 * Stub `playwright` exposing only what the fixtures touch. Every launch's
 * options are appended to $LAUNCH_LOG so the parent test can assert which build
 * the fixture settled on, and $FAKE_PW_MODE decides whether the first (default,
 * headless-shell) launch fails the way Playwright does.
 */
const FAKE_PLAYWRIGHT = `
import { appendFileSync } from "node:fs";

const page = {
  close: async () => {},
  goto: async () => {},
  setContent: async () => {},
  click: async () => {},
  fill: async () => {},
  textContent: async () => null,
  content: async () => "",
  evaluate: async (fn) => fn(),
};
const context = { newPage: async () => page, close: async () => {} };
const browser = {
  newContext: async () => context,
  close: async () => {},
  isConnected: () => true,
};

export const chromium = {
  launch(options) {
    appendFileSync(process.env.LAUNCH_LOG, JSON.stringify(options) + "\\n");
    if (process.env.FAKE_PW_MODE === "missing-shell" && options.channel === undefined) {
      return Promise.reject(
        new Error(
          "browserType.launch: Executable doesn't exist at " +
            "/tmp/none/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
        ),
      );
    }
    return Promise.resolve(browser);
  },
};
`;

const PROBE_TEST = [
  `import { test } from "./index.js";`,
  `test("needs browser", async ({ browser }) => {`,
  `  if (!browser) throw new Error("fixture resolved to nothing");`,
  `  if (typeof browser.newContext !== "function") throw new Error("not a browser");`,
  `});`,
].join("\n");

function runProbe(mode: LaunchMode) {
  const scratch = mkdtempSync(join(tmpdir(), "bun-test-utils-shell-"));
  try {
    copyFileSync(distEntry, join(scratch, "index.js"));

    const stub = join(scratch, "node_modules", "playwright");
    mkdirSync(stub, { recursive: true });
    writeFileSync(
      join(stub, "package.json"),
      JSON.stringify({
        name: "playwright",
        version: "0.0.0",
        type: "module",
        main: "index.js",
      }),
    );
    writeFileSync(join(stub, "index.js"), FAKE_PLAYWRIGHT);

    const launchLog = join(scratch, "launches.jsonl");
    writeFileSync(launchLog, "");
    writeFileSync(join(scratch, "probe.test.js"), PROBE_TEST);

    // --no-install disables Bun's global-cache resolution fallback, so the
    // bare "playwright" specifier resolves to the stub and nothing else.
    const result = Bun.spawnSync({
      cmd: [process.execPath, "--no-install", "test", "probe.test.js"],
      cwd: scratch,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, FAKE_PW_MODE: mode, LAUNCH_LOG: launchLog },
    });

    return {
      exitCode: result.exitCode,
      output: `${result.stdout.toString()}${result.stderr.toString()}`,
      launches: readFileSync(launchLog, "utf8")
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line)),
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

describe.skipIf(!distBuilt)(
  "@bun-test-utils/browser — headless shell fallback",
  () => {
    test("missing headless shell: retries against the full chromium build", () => {
      const probe = runProbe("missing-shell");

      expect(probe.output).toContain("1 pass");
      expect(probe.exitCode).toBe(0);
      // First the default launch, then the retry on the full build.
      expect(probe.launches).toEqual([
        { headless: true },
        { headless: true, channel: "chromium" },
      ]);
    });

    test("installed headless shell: launches it once, untouched", () => {
      const probe = runProbe("shell-present");

      expect(probe.output).toContain("1 pass");
      expect(probe.exitCode).toBe(0);
      // No retry and no channel override: the shell stays the default path.
      expect(probe.launches).toEqual([{ headless: true }]);
    });
  },
);

import { describe, expect, test } from "bun:test";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Error-path coverage for the optional `playwright` peer (spec 0011 R3 /
 * task_016 checklist: importing a gated subpath without its peer must fail
 * with a clear, actionable error naming the missing package).
 *
 * A real uninstalled-peer simulation beats module mocking here: bun's mock
 * cache cannot reliably override a specifier the same process already loaded
 * from the monorepo. Instead the BUILT artifact (zero static imports —
 * playwright arrives via `await import()`) is copied into a temp directory
 * outside the workspace, where bare `playwright` genuinely resolves nowhere,
 * and a `bun` subprocess asks the fixture for a browser.
 *
 * Skipped when dist/index.js is absent (run `bun run build` first; Turborepo's
 * `test` task already depends on `^build`).
 */
const distEntry = join(import.meta.dir, "..", "dist", "index.js");
const distBuilt = existsSync(distEntry);

describe.skipIf(!distBuilt)(
  "@bun-test-utils/browser — playwright peer missing",
  () => {
    test("uninstalled peer: actionable error naming package and install command", async () => {
      const scratch = mkdtempSync(join(tmpdir(), "bun-test-utils-no-peer-"));
      try {
        copyFileSync(distEntry, join(scratch, "index.js"));
        writeFileSync(
          join(scratch, "probe.js"),
          [
            `const { browserFixture } = await import("./index.js");`,
            `try {`,
            `  await browserFixture.setup(async () => {}, { testFile: "probe" });`,
            `  console.error("probe reached use() — launch should be impossible");`,
            `  process.exit(1);`,
            `} catch (error) {`,
            `  console.log(String(error?.message ?? error));`,
            `}`,
          ].join("\n"),
        );

        // --no-install disables Bun's global-cache resolution fallback, so a
        // bare "playwright" specifier from this directory is genuinely
        // unresolvable — the situation a consumer without the peer is in.
        const result = Bun.spawnSync({
          cmd: [process.execPath, "--no-install", "probe.js"],
          cwd: scratch,
          stdout: "pipe",
          stderr: "pipe",
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.toString().trim()).toBe(
          "[@bun-test-utils/browser] 'playwright' is required for browser fixtures. " +
            "Install via 'bun add -d playwright'.",
        );
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  },
);

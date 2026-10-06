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
 * Error-path coverage for the optional `playwright` peer (spec 0011 R3):
 * requesting the root `browser` fixture without its peer must fail with a clear,
 * actionable error naming the missing package.
 *
 * A real uninstalled-peer simulation beats module mocking here: bun's mock
 * cache cannot reliably override a specifier the same process already loaded
 * from the monorepo. Instead the BUILT public root artifact (zero static
 * playwright imports — playwright arrives via `await import()`) is copied into a
 * temp directory outside the workspace, where bare `playwright` genuinely
 * resolves nowhere, and a `bun test` subprocess asks the fixture for a browser.
 *
 * Skipped when dist/plugin.js is absent (run `bun run build` first; Turborepo's
 * `test` task already depends on `^build`).
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

describe.skipIf(!distBuilt)(
  "@bun-test-utils/browser — playwright peer missing",
  () => {
    test("uninstalled peer: actionable error naming package and install command", async () => {
      const scratch = mkdtempSync(join(tmpdir(), "bun-test-utils-no-peer-"));
      try {
        copyFileSync(distEntry, join(scratch, "index.js"));
        writeFileSync(
          join(scratch, "probe.test.js"),
          [
            `import { test } from "./index.js";`,
            `test("needs browser", async ({ browser }) => {`,
            `  if (!browser) throw new Error("unreachable");`,
            `});`,
          ].join("\n"),
        );

        // --no-install disables Bun's global-cache resolution fallback, so a
        // bare "playwright" specifier from this directory is genuinely
        // unresolvable — the situation a consumer without the peer is in.
        const result = Bun.spawnSync({
          cmd: [process.execPath, "--no-install", "test", "probe.test.js"],
          cwd: scratch,
          stdout: "pipe",
          stderr: "pipe",
        });
        const output = `${result.stdout.toString()}${result.stderr.toString()}`;

        expect(result.exitCode).toBe(1);
        expect(output).toContain(
          "[@bun-test-utils/browser] 'playwright' is required for browser fixtures. " +
            "Install via 'bun add -d playwright'.",
        );
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  },
);

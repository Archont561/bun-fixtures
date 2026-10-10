/**
 * Error-path coverage for the optional `@aboviq/bun-test-cucumber` peer of
 * the BDD runner: `test.scenario()` without the integration must fail with a
 * clear, actionable error naming the package — not with Bun's generic
 * module-resolution failure.
 *
 * As in packages/browser/tests/playwright-missing-peer.test.ts, a real
 * uninstalled-peer simulation beats module mocking here: bun's mock cache
 * cannot reliably override a specifier the same process already loaded from
 * the monorepo. The BUILT public root artifact (where the BDD wrapper is
 * bundled; the integration is resolved lazily via `createRequire().resolve`)
 * is copied into a temp directory outside the workspace, where the bare
 * specifier genuinely resolves nowhere, and a `bun test` subprocess declares
 * a scenario.
 *
 * Skipped when dist/plugin.js is absent (run `bun run build` first;
 * Turborepo's `test` task already depends on `^build`).
 */

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
  "@bun-test-utils/bdd — bun-test-cucumber peer missing",
  () => {
    test("uninstalled peer: test.scenario fails with the actionable error", async () => {
      const scratch = mkdtempSync(join(tmpdir(), "bun-test-utils-no-bdd-"));
      try {
        copyFileSync(distEntry, join(scratch, "index.js"));
        writeFileSync(
          join(scratch, "probe.test.js"),
          [
            `import { test } from "./index.js";`,
            `test.scenario("needs the BDD integration");`,
          ].join("\n"),
        );

        // --no-install disables Bun's global-cache resolution fallback, so
        // the bare "@aboviq/bun-test-cucumber" specifier from this directory
        // is genuinely unresolvable — the situation a consumer without the
        // peer is in.
        const result = Bun.spawnSync({
          cmd: [process.execPath, "--no-install", "test", "probe.test.js"],
          cwd: scratch,
          stdout: "pipe",
          stderr: "pipe",
        });
        const output = `${result.stdout.toString()}${result.stderr.toString()}`;

        expect(result.exitCode).toBe(1);
        expect(output).toContain(
          "[bun-test-utils] test.scenario() requires '@aboviq/bun-test-cucumber'. " +
            "Install via 'bun add -d @aboviq/bun-test-cucumber'.",
        );
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  },
);

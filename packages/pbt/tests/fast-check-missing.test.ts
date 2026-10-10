/**
 * Error-path coverage for the optional `fast-check` peer of the property
 * runner: `test.prop()` without fast-check must fail with a clear, actionable
 * error naming the package — not with Bun's generic module-resolution
 * failure.
 *
 * As in packages/browser/tests/playwright-missing-peer.test.ts, a real
 * uninstalled-peer simulation beats module mocking here: bun's mock cache
 * cannot reliably override a specifier the same process already loaded from
 * the monorepo. The BUILT public root artifact (where the property runner is
 * bundled; fast-check arrives via a lazy `import()` guarded by a
 * `createRequire().resolve` check) is copied into a temp directory outside
 * the workspace, where bare `fast-check` genuinely resolves nowhere, and a
 * `bun test` subprocess declares a property test.
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
  "@bun-test-utils/pbt — fast-check peer missing",
  () => {
    test("uninstalled peer: test.prop fails with the actionable error", async () => {
      const scratch = mkdtempSync(join(tmpdir(), "bun-test-utils-no-fc-"));
      try {
        copyFileSync(distEntry, join(scratch, "index.js"));
        writeFileSync(
          join(scratch, "probe.test.js"),
          [
            `import { test } from "./index.js";`,
            `test.prop("needs fast-check", { n: 1 }, () => {});`,
          ].join("\n"),
        );

        // --no-install disables Bun's global-cache resolution fallback, so a
        // bare "fast-check" specifier from this directory is genuinely
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
          "[bun-test-utils] test.prop() requires 'fast-check'. " +
            "Install via 'bun add -d fast-check'.",
        );
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  },
);

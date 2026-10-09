import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Pin the real launch proof's CI/local policy without downloading a browser. */
function runWithoutFirefox(ci: string) {
  const cache = mkdtempSync(join(tmpdir(), "bun-test-utils-no-firefox-"));
  try {
    const result = Bun.spawnSync({
      cmd: [process.execPath, "test", "./firefox-headless.test.ts"],
      cwd: import.meta.dir,
      env: { ...process.env, CI: ci, PLAYWRIGHT_BROWSERS_PATH: cache },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10_000,
    });
    return {
      exitCode: result.exitCode,
      output: `${result.stdout.toString()}${result.stderr.toString()}`,
    };
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
}

describe("@bun-test-utils/browser — Firefox availability policy", () => {
  test("CI fails rather than skipping when Firefox is missing", () => {
    const result = runWithoutFirefox("true");

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Executable doesn't exist");
    expect(result.output).toContain("2 fail");
    expect(result.output).not.toContain("(skip)");
  });

  test("local runs keep the documented skip when Firefox is unavailable", () => {
    const result = runWithoutFirefox("");

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("2 skip");
    expect(result.output).toContain("0 fail");
  });
});

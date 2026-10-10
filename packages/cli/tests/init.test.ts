import { describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addPreload, DEFAULT_ENTRY, init } from "@/init.ts";

describe("init (ADR 0037, rule 3)", () => {
  test("defaults to the entry Bun can actually resolve", () => {
    expect(DEFAULT_ENTRY).toBe(
      "./node_modules/@archont561/bun-test-utils/dist/plugin.js",
    );
  });

  test("adds the preload entry to an empty bunfig", () => {
    const { text, changed } = addPreload(
      "",
      "node_modules/@archont561/bun-test-utils/dist/plugin.js",
    );
    expect(changed).toBe(true);
    expect(text).toContain("preload");
    expect(text).toContain(
      "node_modules/@archont561/bun-test-utils/dist/plugin.js",
    );
  });

  test("preserves existing config and is idempotent", () => {
    const start =
      '[install]\nregistry = "https://registry.npmjs.org"\n\n[test]\npreload = ["./other.ts"]\n';
    const once = addPreload(
      start,
      "node_modules/@archont561/bun-test-utils/dist/plugin.js",
    );
    expect(once.changed).toBe(true);
    expect(once.text).toContain("./other.ts");
    expect(once.text).toContain("registry");
    const twice = addPreload(
      once.text,
      "node_modules/@archont561/bun-test-utils/dist/plugin.js",
    );
    expect(twice.changed).toBe(false);
  });

  test("normalizes a string preload into a list", () => {
    const { text } = addPreload('[test]\npreload = "./a.ts"\n', "./b.ts");
    expect(text).toMatch(/preload = \[.*"\.\/a\.ts".*"\.\/b\.ts".*\]/s);
  });

  test("writes bunfig.toml when confirmed", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const dir = mkdtempSync(join(tmpdir(), "cli-init-"));
      const asked: string[] = [];
      await init({
        dir,
        entry: "./custom/plugin.ts",
        force: true,
        confirm: (message) => {
          asked.push(message);
          return true;
        },
      });
      expect(asked).toHaveLength(1);
      expect(asked[0]).toContain(join(dir, "bunfig.toml"));
      expect(readFileSync(join(dir, "bunfig.toml"), "utf8")).toContain(
        "./custom/plugin.ts",
      );
    } finally {
      log.mockRestore();
    }
  });

  test("cancelling the confirmation writes nothing", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const dir = mkdtempSync(join(tmpdir(), "cli-init-"));
      let asked = 0;
      await init({
        dir,
        entry: "./custom/plugin.ts",
        force: true,
        confirm: () => {
          asked++;
          return false;
        },
      });
      expect(asked).toBe(1);
      expect(existsSync(join(dir, "bunfig.toml"))).toBe(false);
    } finally {
      log.mockRestore();
    }
  });

  test("does not ask when the entry is already preloaded", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const dir = mkdtempSync(join(tmpdir(), "cli-init-"));
      writeFileSync(
        join(dir, "bunfig.toml"),
        '[test]\npreload = ["./custom/plugin.ts"]\n',
      );
      let asked = 0;
      await init({
        dir,
        entry: "./custom/plugin.ts",
        force: true,
        confirm: () => {
          asked++;
          return true;
        },
      });
      expect(asked).toBe(0);
    } finally {
      log.mockRestore();
    }
  });

  test("without a confirm callback it writes directly (flag-only path)", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const dir = mkdtempSync(join(tmpdir(), "cli-init-"));
      await init({ dir, entry: "./custom/plugin.ts", force: true });
      expect(existsSync(join(dir, "bunfig.toml"))).toBe(true);
    } finally {
      log.mockRestore();
    }
  });
});

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "citty";
import { addPreload, DEFAULT_ENTRY, initCommand } from "@/cli.ts";
import { describe, expect, test } from "@/plugin.ts";

describe("cli", () => {
  test("parses arguments with citty", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-args-"));
    const { result } = await runCommand(initCommand, {
      rawArgs: ["--dir", dir, "--entry", "./custom/plugin.ts", "--force"],
    });
    await result;
    expect(readFileSync(join(dir, "bunfig.toml"), "utf8")).toContain(
      "./custom/plugin.ts",
    );
    expect(readFileSync(join(dir, "test.ts"), "utf8")).toContain("base.extend");
  });

  test("defaults to the entry Bun can actually resolve", () => {
    expect(DEFAULT_ENTRY).toBe("./node_modules/bun-test-utils/dist/plugin.js");
  });

  test("adds the preload entry to an empty bunfig", () => {
    const { text, changed } = addPreload(
      "",
      "node_modules/bun-test-utils/dist/plugin.js",
    );
    expect(changed).toBe(true);
    expect(text).toContain("preload");
    expect(text).toContain("node_modules/bun-test-utils/dist/plugin.js");
  });

  test("preserves existing config and is idempotent", () => {
    const start =
      '[install]\nregistry = "https://registry.npmjs.org"\n\n[test]\npreload = ["./other.ts"]\n';
    const once = addPreload(
      start,
      "node_modules/bun-test-utils/dist/plugin.js",
    );
    expect(once.changed).toBe(true);
    expect(once.text).toContain("./other.ts");
    expect(once.text).toContain("registry");
    const twice = addPreload(
      once.text,
      "node_modules/bun-test-utils/dist/plugin.js",
    );
    expect(twice.changed).toBe(false);
  });

  test("normalizes a string preload into a list", () => {
    const { text } = addPreload('[test]\npreload = "./a.ts"\n', "./b.ts");
    expect(text).toMatch(/preload = \[.*"\.\/a\.ts".*"\.\/b\.ts".*\]/s);
  });
});

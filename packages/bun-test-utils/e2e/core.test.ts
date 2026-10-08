import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "@archont561/bun-test-utils";

describe("end to end", () => {
  test(
    "a fresh project: init → preload → run → teardown",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-e2e-"));
      const repo = join(import.meta.dir, "..");
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      mkdirSync(join(dir, "node_modules", "@archont561"), { recursive: true });
      symlinkSync(
        repo,
        join(dir, "node_modules", "@archont561", "bun-test-utils"),
      );
      mkdirSync(join(dir, "sub"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        '{"name":"e2e","type":"module"}',
      );

      const init = Bun.spawnSync({
        cmd: [
          "bun",
          join(repo, "src", "cli.ts"),
          "init",
          "--dir",
          dir,
          "--force",
        ],
      });
      expect(init.exitCode).toBe(0);

      writeFileSync(
        join(dir, "test.ts"),
        `import { test as base } from "@archont561/bun-test-utils";
export const test = base.extend({
  server: {
    scope: "session",
    setup: async (use) => { console.log("up"); await use({ port: 1234 }); console.log("down"); },
  },
  user: {
    setup: async (use, { server }) => { await use({ name: "ada", port: server.port }); },
  },
});\n`,
      );
      writeFileSync(
        join(dir, "sub", "e2e.test.ts"),
        `import { expect } from "@archont561/bun-test-utils";
import { test } from "../test";
test("injects across directories", async ({ user }) => {
  expect(user).toEqual({ name: "ada", port: 1234 });
});\n`,
      );

      const run = Bun.spawnSync({ cmd: ["bun", "test"], cwd: dir });
      const output = `${run.stdout.toString()}${run.stderr.toString()}`;
      expect(output).toContain("1 pass");
      expect(output).toContain("0 fail");
      // session fixture built once, torn down after the run
      expect(output.indexOf("up")).toBeLessThan(output.indexOf("down"));

      // An extension only includes the fixtures it declares. A fixture whose
      // setup depends on an omitted fixture must fail registration rather than
      // silently running with an incomplete context.
      writeFileSync(
        join(dir, "missing-dependency.test.ts"),
        `import { test as base } from "@archont561/bun-test-utils";
const test = base.extend({
  dependent: {
    setup: async (use, { database }) => { await use(database); },
  },
});
test("rejects an omitted dependency", ({ dependent }) => {
  void dependent;
});
`,
      );
      const failed = Bun.spawnSync({
        cmd: ["bun", "test", "missing-dependency.test.ts"],
        cwd: dir,
      });
      const failedOutput = `${failed.stdout.toString()}${failed.stderr.toString()}`;
      expect(failed.exitCode).not.toBe(0);
      expect(failedOutput).toContain('unknown fixture "database"');
    },
    { timeout: 30_000 },
  );
});

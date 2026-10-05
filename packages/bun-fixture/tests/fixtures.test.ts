/**
 * Dogfooding: the fixture engine is tested with itself.
 *
 * `bunfig.toml` preloads `./src/plugin.ts`, which discovers `fixtures.ts`
 * (root) and `tests/fixtures.ts` (this directory) before anything runs.
 */

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTest,
  describe,
  destructuredKeys,
  expect,
  fixturesFor,
  paramCombos,
  resolveOrder,
  test,
} from "bun-fixture";
import { runCommand } from "citty";
import { addPreload, DEFAULT_ENTRY, initCommand } from "@/src/cli.ts";

const here = import.meta.path;

describe("injection", () => {
  test("injects a session fixture", async ({ config }) => {
    expect(config.name).toBe("bun-fixture");
  });

  test("sees the fixtures.ts of its own directory", async ({ origin }) => {
    expect(origin).toBe("tests");
  });

  test("resolves dependencies by name", async ({ client }) => {
    expect(client.connected).toBe(true);
    expect(client.tmp).toHaveProperty("n");
  });

  test(
    "supports an explicit fixture list",
    async (ctx) => {
      expect(ctx.answer).toBe(42);
    },
    { fixtures: ["answer"] },
  );

  test("exposes test metadata on the context", async ({
    testFile,
    testName,
  }) => {
    expect(testFile).toBe(here);
    expect(testName).toContain("metadata");
  });
});

describe("scopes", () => {
  let firstDbId: number | undefined;

  test("file-scoped fixtures are created once per file", async ({ db }) => {
    firstDbId = db.id;
    db.rows.push("a");
    expect(db.rows).toEqual(["a"]);
  });

  test("...and shared with the next test in the same file", async ({ db }) => {
    expect(db.id).toBe(firstDbId!);
    expect(db.rows).toEqual(["a"]);
  });

  test("test-scoped fixtures are rebuilt every test", async ({
    tmp,
    events,
  }) => {
    expect(
      events.filter((e: string) => e === "tmp:setup").length,
    ).toBeGreaterThan(1);
    expect(tmp.n).toBeGreaterThanOrEqual(0);
  });

  test("teardown is LIFO", async ({ events }) => {
    // The "resolves dependencies by name" test built tmp → client,
    // so it must have torn down client → tmp.
    const trace = events.join(" ");
    expect(trace).toContain("tmp:setup client:setup");
    expect(trace).toContain("client:teardown tmp:teardown");
  });
});

describe("parameterization", () => {
  const seen: string[] = [];

  test("runs once per param", async ({ mode }) => {
    seen.push(mode);
    expect(["fast", "slow"]).toContain(mode);
  });

  test("produces the cartesian product", async ({ mode, region }) => {
    seen.push(`${mode}/${region}`);
    expect(`${mode}/${region}`).toMatch(/^(fast|slow)\/(eu|us)$/);
  });

  test("...which means 2 + 4 cases ran before this one", () => {
    expect(seen.sort()).toEqual([
      "fast",
      "fast/eu",
      "fast/us",
      "slow",
      "slow/eu",
      "slow/us",
    ]);
  });
});

describe("engine internals", () => {
  const map = fixturesFor(here);

  test("merges every fixtures.ts from the root down to this directory", () => {
    expect(Object.keys(map).sort()).toEqual([
      "answer",
      "client",
      "config",
      "db",
      "env",
      "events",
      "mode",
      "origin",
      "region",
      "stdio",
      "tmp",
      "tmpdir",
    ]);
  });

  test("orders dependencies first", () => {
    expect(resolveOrder(["client"], map, here)).toEqual([
      "events",
      "tmp",
      "client",
    ]);
  });

  test("throws on an unknown fixture", () => {
    expect(() => resolveOrder(["nope"], map, here)).toThrow(
      /unknown fixture "nope"/,
    );
  });

  test("throws on a scope violation", () => {
    const bad = {
      short: { scope: "test" as const, setup: async (use: any) => use(1) },
      long: {
        scope: "session" as const,
        deps: ["short"],
        setup: async (use: any) => use(2),
      },
    };
    expect(() => resolveOrder(["long"], bad, here)).toThrow(/scope mismatch/);
  });

  test("throws on a dependency cycle", () => {
    const cyclic = {
      a: { deps: ["b"], setup: async (use: any) => use(1) },
      b: { deps: ["a"], setup: async (use: any) => use(2) },
    };
    expect(() => resolveOrder(["a"], cyclic, here)).toThrow(
      /circular fixture dependency/,
    );
  });

  test("computes param combinations", () => {
    expect(paramCombos(["mode", "region"], map)).toEqual([
      { mode: 0, region: 0 },
      { mode: 0, region: 1 },
      { mode: 1, region: 0 },
      { mode: 1, region: 1 },
    ]);
  });

  test("detects destructured parameters", () => {
    expect(
      destructuredKeys(async (use: any, { db, tmp }: any) => [use, db, tmp], 1),
    ).toEqual(["db", "tmp"]);
    expect(destructuredKeys(({ a = 1, b: c }: any) => [a, c], 0)).toEqual([
      "a",
      "b",
    ]);
    expect(destructuredKeys((ctx: any) => ctx, 0)).toEqual([]);
  });

  test("createTest binds to an explicit file", () => {
    const bound = createTest(here);
    expect(typeof bound.test).toBe("function");
    expect(bound.expect).toBe(expect);
  });
});

describe("cli", () => {
  test("parses arguments with citty", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bun-fixture-args-"));
    const { result } = await runCommand(initCommand, {
      rawArgs: ["--dir", dir, "--entry", "./custom/plugin.ts", "--force"],
    });
    await result;
    expect(readFileSync(join(dir, "bunfig.toml"), "utf8")).toContain(
      "./custom/plugin.ts",
    );
    expect(readFileSync(join(dir, "fixtures.ts"), "utf8")).toContain(
      "satisfies FixtureMap",
    );
  });

  test("defaults to the entry Bun can actually resolve", () => {
    expect(DEFAULT_ENTRY).toBe("./node_modules/bun-fixture/src/plugin.ts");
  });

  test("adds the preload entry to an empty bunfig", () => {
    const { text, changed } = addPreload(
      "",
      "node_modules/bun-fixture/src/plugin.ts",
    );
    expect(changed).toBe(true);
    expect(text).toContain("preload");
    expect(text).toContain("node_modules/bun-fixture/src/plugin.ts");
  });

  test("preserves existing config and is idempotent", () => {
    const start =
      '[install]\nregistry = "https://registry.npmjs.org"\n\n[test]\npreload = ["./other.ts"]\n';
    const once = addPreload(start, "node_modules/bun-fixture/src/plugin.ts");
    expect(once.changed).toBe(true);
    expect(once.text).toContain("./other.ts");
    expect(once.text).toContain("registry");
    const twice = addPreload(
      once.text,
      "node_modules/bun-fixture/src/plugin.ts",
    );
    expect(twice.changed).toBe(false);
  });

  test("normalizes a string preload into a list", () => {
    const { text } = addPreload('[test]\npreload = "./a.ts"\n', "./b.ts");
    expect(text).toMatch(/preload = \[.*"\.\/a\.ts".*"\.\/b\.ts".*\]/s);
  });

  test("`init` scaffolds a project end to end", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bun-fixture-cli-"));
    const proc = Bun.spawnSync({
      cmd: [
        "bun",
        join(import.meta.dir, "..", "src", "cli.ts"),
        "init",
        "--dir",
        dir,
      ],
    });
    expect(proc.exitCode).toBe(0);
    expect(readFileSync(join(dir, "bunfig.toml"), "utf8")).toContain(
      "node_modules/bun-fixture/src/plugin.ts",
    );
    expect(readFileSync(join(dir, "fixtures.ts"), "utf8")).toContain(
      "export default",
    );
  });
});

describe("end to end", () => {
  test(
    "a fresh project: init → preload → run → teardown",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "bun-fixture-e2e-"));
      const repo = join(import.meta.dir, "..");
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      symlinkSync(repo, join(dir, "node_modules", "bun-fixture"));
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
        join(dir, "fixtures.ts"),
        `export default {
         server: {
           scope: "session",
           setup: async (use) => { console.log("up"); await use({ port: 1234 }); console.log("down"); },
         },
       };\n`,
      );
      writeFileSync(
        join(dir, "sub", "fixtures.ts"),
        `export default {
         user: { setup: async (use, { server }) => { await use({ name: "ada", port: server.port }); } },
       };\n`,
      );
      writeFileSync(
        join(dir, "sub", "e2e.test.ts"),
        `import { test, expect } from "bun-fixture";
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
    },
    { timeout: 30_000 },
  );
});

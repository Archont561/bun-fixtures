/**
 * M5 pack smoke test (spec 0005 R7, milestone M5 exit criteria 1–2).
 *
 * Packs the single publishable package with `bun pm pack`, proves the tarball
 * contains the public root and the two approved typed-helper subpaths, then
 * installs it into a scratch project and runs the quickstart
 * (`test-utils init` → `bun test`) against the packed artifact. What is verified
 * here is what a consumer downloading from npm will get.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "@archont561/bun-test-utils";

const BUN = process.execPath;
const PACKAGE_DIR = join(import.meta.dir, "..");

/** The one publishable package — everything else it bundles is `private: true`. */
const PACKAGE_NAME = "@archont561/bun-test-utils";
/** npm folds the scope into the tarball name: `@scope/name` packs to `scope-name-<version>.tgz`. */
const TARBALL_NAME = "archont561-bun-test-utils";

/** Internal workspace packages that must stay private. */
const INTERNAL_WORKSPACES = [
  "core",
  "std",
  "pbt",
  "dom",
  "browser",
  "vcr",
  "snapshot",
  "bdd",
] as const;

/** Files the built tarball may contain besides `dist/`. */
const ALLOWED_TOP_LEVEL = new Set([
  "package.json",
  "README.md",
  "LICENSE-MIT",
  "LICENSE-APACHE",
]);

interface Packed {
  tgz: string;
  entries: string[];
  manifest: Record<string, any>;
}

function run(cmd: string[], cwd?: string): string {
  const proc = Bun.spawnSync({
    cmd,
    cwd,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  // stdout + stderr, which is where `bun test` splits its reporting.
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
  if (proc.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed (${proc.exitCode}):\n${output}`);
  }
  return output;
}

/** Packs the package and reads back its tarball. */
function pack(scratch: string): Packed {
  const tgz = join(scratch, `${TARBALL_NAME}.tgz`);
  run(
    [BUN, "pm", "pack", "--quiet", "--ignore-scripts", "--filename", tgz],
    PACKAGE_DIR,
  );
  expect(existsSync(tgz)).toBe(true);

  const listing = run(["tar", "-tzf", tgz]).trim().split("\n");
  expect(listing.every((e) => e.startsWith("package/"))).toBe(true);
  const entries = listing.map((e) => e.slice("package/".length));

  const unpack = join(scratch, "unpack");
  mkdirSync(unpack, { recursive: true });
  run(["tar", "-xzf", tgz, "-C", unpack, "package/package.json"]);
  const manifest = JSON.parse(
    readFileSync(join(unpack, "package", "package.json"), "utf8"),
  );
  return { tgz, entries, manifest };
}

describe("bun pm pack smoke test", () => {
  test("the publishable package wraps sibling internal workspaces", () => {
    for (const workspace of INTERNAL_WORKSPACES) {
      expect(
        existsSync(join(PACKAGE_DIR, "..", workspace, "package.json")),
        `${workspace} workspace is missing`,
      ).toBe(true);
      expect(existsSync(join(PACKAGE_DIR, workspace, "package.json"))).toBe(
        false,
      );
    }
    expect(
      readFileSync(join(PACKAGE_DIR, "src", "plugin.ts"), "utf8"),
    ).toContain("@bun-test-utils/core");
  });

  test("the tarball name is the one npm gives the scoped package", () => {
    expect(TARBALL_NAME).toBe(PACKAGE_NAME.replace(/^@/, "").replace("/", "-"));
  });

  test(
    "the one publishable tarball exposes only the root runner and typed-helper subpaths",
    () => {
      const scratch = mkdtempSync(join(tmpdir(), "bun-test-utils-pack-"));
      try {
        const { entries, manifest } = pack(scratch);

        expect(manifest.name).toBe(PACKAGE_NAME);
        expect(manifest.private).toBeUndefined();
        expect(manifest.license).toBe("MIT OR Apache-2.0");
        expect(manifest.main).toBe("./dist/plugin.js");
        expect(manifest.types).toBe("./dist/plugin.d.ts");
        expect(entries.some((entry) => entry.startsWith("dist/"))).toBe(true);
        expect(JSON.stringify(manifest)).not.toContain("workspace:");
        expect(Object.keys(manifest.exports).sort()).toEqual([
          ".",
          "./bdd",
          "./package.json",
          "./pbt",
          "./snap",
          "./vcr",
        ]);

        for (const peer of [
          "playwright",
          "happy-dom",
          "fast-check",
          "@aboviq/bun-test-cucumber",
        ]) {
          expect(manifest.peerDependencies?.[peer]).toBeString();
          expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true);
          expect(manifest.optionalDependencies?.[peer]).toBeUndefined();
        }

        for (const required of ALLOWED_TOP_LEVEL) {
          expect(entries).toContain(required);
        }
        for (const required of [
          "dist/plugin.js",
          "dist/plugin.d.ts",
          "dist/pbt.js",
          "dist/pbt.d.ts",
          "dist/bdd.js",
          "dist/bdd.d.ts",
          "dist/cli.js",
          "dist/cli.d.ts",
          "dist/vcr.js",
          "dist/vcr.d.ts",
        ]) {
          expect(entries).toContain(required);
        }
        expect(entries.some((e) => e.startsWith("src/"))).toBe(false);
        expect(entries.some((e) => e.startsWith("core/"))).toBe(false);
        expect(entries.some((e) => e.startsWith("dist/subpaths/"))).toBe(false);

        for (const entry of entries) {
          const topLevel = entry.split("/")[0];
          const ok = ALLOWED_TOP_LEVEL.has(entry) || topLevel === "dist";
          expect(ok, `tarball contains unexpected ${entry}`).toBe(true);
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
    { timeout: 120_000 },
  );

  test("publication audit: peers and private workspaces are clean", () => {
    const manifest = JSON.parse(
      readFileSync(join(PACKAGE_DIR, "package.json"), "utf8"),
    );
    expect(Object.keys(manifest.exports).sort()).toEqual([
      ".",
      "./bdd",
      "./package.json",
      "./pbt",
      "./snap",
      "./vcr",
    ]);

    for (const peer of [
      "playwright",
      "happy-dom",
      "fast-check",
      "@aboviq/bun-test-cucumber",
    ]) {
      expect(manifest.peerDependencies?.[peer]).toBeString();
      expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true);
      expect(manifest.optionalDependencies?.[peer]).toBeUndefined();
    }

    for (const workspace of INTERNAL_WORKSPACES) {
      const workspaceManifest = JSON.parse(
        readFileSync(
          join(PACKAGE_DIR, "..", workspace, "package.json"),
          "utf8",
        ),
      );
      expect(
        workspaceManifest.private,
        `${workspace} must remain private`,
      ).toBe(true);
    }

    const licenseFiles = ["LICENSE-MIT", "LICENSE-APACHE"];
    expect(
      licenseFiles.every((file) => existsSync(join(PACKAGE_DIR, file))),
    ).toBe(true);

    for (const file of [
      join(PACKAGE_DIR, "dist", "plugin.js"),
      join(PACKAGE_DIR, "dist", "plugin.d.ts"),
      join(PACKAGE_DIR, "dist", "pbt.js"),
      join(PACKAGE_DIR, "dist", "pbt.d.ts"),
      join(PACKAGE_DIR, "dist", "bdd.js"),
      join(PACKAGE_DIR, "dist", "bdd.d.ts"),
    ]) {
      const output = readFileSync(file, "utf8");
      expect(output).not.toMatch(/(?:from|import)\s*["']@bun-test-utils\//);
    }
  });

  test(
    "the tarball installs and runs the quickstart through the root entrypoint",
    () => {
      const packDir = mkdtempSync(join(tmpdir(), "bun-test-utils-pack-core-"));
      const project = mkdtempSync(join(tmpdir(), "bun-test-utils-quickstart-"));
      try {
        const { manifest } = pack(packDir);

        writeFileSync(
          join(project, "package.json"),
          JSON.stringify({ name: "quickstart-smoke", type: "module" }),
        );
        run([BUN, "add", join(packDir, `${TARBALL_NAME}.tgz`)], project);
        expect(
          existsSync(
            join(project, "node_modules", PACKAGE_NAME, "dist", "plugin.js"),
          ),
        ).toBe(true);
        expect(
          existsSync(
            join(project, "node_modules", PACKAGE_NAME, "dist", "subpaths"),
          ),
        ).toBe(false);
        expect(
          existsSync(join(project, "node_modules", PACKAGE_NAME, "src")),
        ).toBe(false);

        run(
          [
            BUN,
            join(project, "node_modules", ".bin", "test-utils"),
            "init",
            "--dir",
            project,
            "--force",
          ],
          project,
        );
        expect(readFileSync(join(project, "bunfig.toml"), "utf8")).toContain(
          "node_modules/@archont561/bun-test-utils/dist/plugin.js",
        );
        expect(existsSync(join(project, "test.ts"))).toBe(false);

        writeFileSync(
          join(project, "quickstart.test.ts"),
          `import { describe, expect, test } from "@archont561/bun-test-utils";
import { givenStep, thenStep, whenStep } from "@archont561/bun-test-utils/bdd";
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";

describe("packed public API", () => {
  test("built-in fixtures inject from the root test", async ({ tmpdir }) => {
    tmpdir.write("hello.txt", "hello");
    expect(tmpdir.read("hello.txt")).toBe("hello");
  });

  test("only root runner and helper subpaths are exposed", async () => {
    expect(typeof test.prop).toBe("function");
    const specifier = "@archont561/bun-test-utils/std";
    await expect(import(specifier)).rejects.toThrow();
  });

  test("typed helper subpaths load without optional peers", () => {
    const schema = (fc: unknown) => ({ value: fc });
    const given = (ctx: unknown) => ({ value: ctx });
    const when = (ctx: unknown) => ({ value: ctx });
    const then = (_ctx: unknown) => {};

    expect(defineArbitraries(schema)).toBe(schema);
    expect(givenStep(given)).toBe(given);
    expect(whenStep(when)).toBe(when);
    expect(thenStep(then)).toBe(then);
  });

  test("fixture-based httpMock is bundled into the root context", async ({ httpMock }) => {
    httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
    const user = await fetch("https://example.test/api/user").then((r) =>
      r.json(),
    );
    expect(user).toEqual({ name: "Ada" });
    expect(httpMock.calls()[0]).toMatchObject({ handled: true });
  });

  test("optional test styles explain their missing peers", () => {
    expect(() =>
      test.prop("needs fast-check", (fc) => ({ n: fc.integer() }), () => {}),
    ).toThrow("fast-check");
    expect(() => test.scenario("needs bdd integration")).toThrow(
      "@aboviq/bun-test-cucumber",
    );
  });
});
`,
        );
        const output = run([BUN, "test"], project);
        expect(output).toContain("5 pass");
        expect(output).toContain("0 fail");

        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      } finally {
        rmSync(packDir, { recursive: true, force: true });
        rmSync(project, { recursive: true, force: true });
      }
    },
    { timeout: 180_000 },
  );
});

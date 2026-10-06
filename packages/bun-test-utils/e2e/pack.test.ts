/**
 * M5 pack smoke test (spec 0005 R7, milestone M5 exit criteria 1–2).
 *
 * Packs the single publishable package with `bun pm pack`, proves the tarball
 * contains only what the spec allows (Bunup-built ESM and declarations,
 * README + both licences + manifest, no source workspaces or `workspace:`
 * ranges), then installs the
 * tarball into a scratch project — no workspace, no symlinks — and runs the
 * quickstart (`bun-test-utils init` → `bun test`) against it, including a
 * subpath import. What is verified here is what a consumer downloading from
 * npm will get.
 *
 * Since the single-package consolidation (ADR superseding ADR 0011,
 * task_018/task_020), `core`, `std`, `pbt`, `dom`, `browser`, `vcr`, and
 * `snapshot` are sibling internal, unpublished (`private: true`) workspace
 * packages are linked into the wrapper during development and bundled by Bunup
 * into its `dist/`; they are never published on their own.
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
import { describe, expect, test } from "bun-test-utils";

const BUN = process.execPath;
const PACKAGE_DIR = join(import.meta.dir, "..");

/** The one publishable package — everything else it bundles is `private: true`. */
const PACKAGE_NAME = "bun-test-utils";

/** Internal workspace packages bundled in as subpaths; never published on their own. */
const BUNDLED_SUBPATHS = [
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
  const tgz = join(scratch, `${PACKAGE_NAME}.tgz`);
  run([BUN, "pm", "pack", "--quiet", "--filename", tgz], PACKAGE_DIR);
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
  test("the publishable package wraps a sibling internal core", () => {
    expect(existsSync(join(PACKAGE_DIR, "..", "core", "package.json"))).toBe(
      true,
    );
    expect(
      readFileSync(join(PACKAGE_DIR, "src", "plugin.ts"), "utf8"),
    ).toContain("@bun-test-utils/core");
    expect(
      existsSync(join(PACKAGE_DIR, "..", "core", "src", "plugin.ts")),
    ).toBe(true);
  });

  test("internal workspace sources live beside the publishable package", () => {
    for (const sub of BUNDLED_SUBPATHS) {
      expect(existsSync(join(PACKAGE_DIR, "..", sub, "package.json"))).toBe(
        true,
      );
      expect(existsSync(join(PACKAGE_DIR, sub, "package.json"))).toBe(false);
    }
  });

  test(
    "the one publishable tarball matches the spec",
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
        for (const peer of ["playwright", "happy-dom", "fast-check"]) {
          expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true);
        }
        // `bun pm pack` must rewrite workspace-ranges (e.g. workspace:^ → ^0.1.0) —
        // moot today since the published manifest has none, but guards regressions.
        expect(JSON.stringify(manifest)).not.toContain("workspace:");

        for (const required of ALLOWED_TOP_LEVEL) {
          expect(entries).toContain(required);
        }
        for (const required of [
          "dist/plugin.js",
          "dist/plugin.d.ts",
          "dist/cli.js",
          "dist/types.d.ts",
        ]) {
          expect(entries).toContain(required);
        }
        expect(entries.some((e) => e.startsWith("src/"))).toBe(false);
        expect(entries.some((e) => e.startsWith("core/"))).toBe(false);

        for (const sub of BUNDLED_SUBPATHS) {
          const output = `./dist/subpaths/${sub}`;
          expect(entries).toContain(`${output.slice(2)}.js`);
          expect(entries).toContain(`${output.slice(2)}.d.ts`);
          expect(manifest.exports?.[`./${sub}`]).toEqual({
            types: `${output}.d.ts`,
            import: `${output}.js`,
            default: `${output}.js`,
          });
        }

        // Nothing else at the top level — no tests/, features/, sources, or repo tooling.
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

  test(
    "the tarball installs and runs the quickstart, including a bundled subpath",
    () => {
      const packDir = mkdtempSync(join(tmpdir(), "bun-test-utils-pack-core-"));
      const project = mkdtempSync(join(tmpdir(), "bun-test-utils-quickstart-"));
      try {
        const { manifest } = pack(packDir);

        writeFileSync(
          join(project, "package.json"),
          JSON.stringify({ name: "quickstart-smoke", type: "module" }),
        );
        run([BUN, "add", join(packDir, `${PACKAGE_NAME}.tgz`)], project);
        expect(
          existsSync(
            join(project, "node_modules", PACKAGE_NAME, "dist", "plugin.js"),
          ),
        ).toBe(true);
        expect(
          existsSync(
            join(
              project,
              "node_modules",
              PACKAGE_NAME,
              "dist",
              "subpaths",
              "std.js",
            ),
          ),
        ).toBe(true);
        expect(
          existsSync(join(project, "node_modules", PACKAGE_NAME, "src")),
        ).toBe(false);

        // `bunx bun-test-utils init` — through the installed bin, like a consumer.
        run(
          [
            BUN,
            join(project, "node_modules", ".bin", "bun-test-utils"),
            "init",
            "--dir",
            project,
            "--force",
          ],
          project,
        );
        expect(readFileSync(join(project, "bunfig.toml"), "utf8")).toContain(
          "node_modules/bun-test-utils/dist/plugin.js",
        );
        expect(readFileSync(join(project, "fixtures.ts"), "utf8")).toContain(
          "export default",
        );

        // The README quickstart against the tarball: init's scaffolded
        // fixtures flow through discovery and injection, and a bundled
        // subpath (`bun-test-utils/std`) resolves with no extra install.
        writeFileSync(
          join(project, "quickstart.test.ts"),
          `import { test, expect } from "bun-test-utils";
import { tmpdirFixture } from "bun-test-utils/std";

test("quickstart: scaffolded fixtures inject", async ({ config, tmpDir }) => {
  expect(config).toEqual({ env: "test" });
  expect(typeof tmpDir).toBe("string");
  expect(tmpDir.length).toBeGreaterThan(0);
});

test("quickstart: bundled subpath resolves with no extra install", () => {
  expect(typeof tmpdirFixture.setup).toBe("function");
});
`,
        );
        const output = run([BUN, "test"], project);
        expect(output).toContain("2 pass");
        expect(output).toContain("0 fail");

        // Sanity: the packed manifest is what a registry consumer sees.
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      } finally {
        rmSync(packDir, { recursive: true, force: true });
        rmSync(project, { recursive: true, force: true });
      }
    },
    { timeout: 180_000 },
  );
});

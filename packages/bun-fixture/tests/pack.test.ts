/**
 * M5 pack smoke test (spec 0005 R7, milestone M5 exit criteria 1–2).
 *
 * Packs every publishable package with `bun pm pack`, proves each tarball
 * contains only what the spec allows (src + README + both licences + manifest,
 * no `workspace:` ranges left in the manifest), then installs the core tarball
 * into a scratch project — no workspace, no symlinks — and runs the quickstart
 * (`bun-fixture init` → `bun test`) against it. What is verified here is what
 * a consumer downloading from npm will get.
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
import { describe, expect, test } from "bun-fixture";

const BUN = process.execPath;
const PACKAGES_DIR = join(import.meta.dir, "..", "..");

/** The six publishable packages (M5 scope grew beyond the core). */
const PUBLISHABLE = [
  { dir: "bun-fixture", name: "bun-fixture" },
  { dir: "std", name: "@bun-fixture/std" },
  { dir: "fast-check", name: "@bun-fixture/fast-check" },
  { dir: "dom", name: "@bun-fixture/dom" },
  { dir: "browser", name: "@bun-fixture/browser" },
  { dir: "vcr", name: "@bun-fixture/vcr" },
] as const;

/** Files a tarball may contain besides anything under `src/` (spec 0005 R2/R10/R11). */
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

/** Packs one package and reads back its tarball. */
function pack(pkgDir: string, scratch: string): Packed {
  const dir = join(PACKAGES_DIR, pkgDir);
  const tgz = join(scratch, `${pkgDir}.tgz`);
  run([BUN, "pm", "pack", "--quiet", "--filename", tgz], dir);
  expect(existsSync(tgz)).toBe(true);

  const listing = run(["tar", "-tzf", tgz]).trim().split("\n");
  expect(listing.every((e) => e.startsWith("package/"))).toBe(true);
  const entries = listing.map((e) => e.slice("package/".length));

  const unpack = join(scratch, `unpack-${pkgDir}`);
  mkdirSync(unpack, { recursive: true });
  run(["tar", "-xzf", tgz, "-C", unpack, "package/package.json"]);
  const manifest = JSON.parse(
    readFileSync(join(unpack, "package", "package.json"), "utf8"),
  );
  return { tgz, entries, manifest };
}

describe("bun pm pack smoke test", () => {
  test(
    "every publishable tarball matches the spec",
    () => {
      const scratch = mkdtempSync(join(tmpdir(), "bun-fixture-pack-"));
      try {
        for (const { dir, name } of PUBLISHABLE) {
          const { entries, manifest } = pack(dir, scratch);

          expect(manifest.name).toBe(name);
          expect(manifest.license).toBe("MIT OR Apache-2.0");
          // `bun pm pack` must rewrite workspace-ranges (e.g. workspace:^ → ^0.1.0).
          expect(JSON.stringify(manifest)).not.toContain("workspace:");

          for (const required of ALLOWED_TOP_LEVEL) {
            expect(entries).toContain(required);
          }
          expect(entries.some((e) => e.startsWith("src/"))).toBe(true);
          // Nothing else — no tests/, features/, .backlog/, docs/…
          for (const entry of entries) {
            const ok = ALLOWED_TOP_LEVEL.has(entry) || entry.startsWith("src/");
            expect(ok, `${name} tarball contains unexpected ${entry}`).toBe(
              true,
            );
          }
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
    { timeout: 120_000 },
  );

  test(
    "the core tarball installs and runs the quickstart",
    () => {
      const packDir = mkdtempSync(join(tmpdir(), "bun-fixture-pack-core-"));
      const project = mkdtempSync(join(tmpdir(), "bun-fixture-quickstart-"));
      try {
        const { manifest } = pack("bun-fixture", packDir);

        writeFileSync(
          join(project, "package.json"),
          JSON.stringify({ name: "quickstart-smoke", type: "module" }),
        );
        run([BUN, "add", join(packDir, "bun-fixture.tgz")], project);
        expect(
          existsSync(
            join(project, "node_modules", "bun-fixture", "src", "plugin.ts"),
          ),
        ).toBe(true);

        // `bunx bun-fixture init` — through the installed bin, like a consumer.
        run(
          [
            BUN,
            join(project, "node_modules", ".bin", "bun-fixture"),
            "init",
            "--dir",
            project,
            "--force",
          ],
          project,
        );
        expect(readFileSync(join(project, "bunfig.toml"), "utf8")).toContain(
          "node_modules/bun-fixture/src/plugin.ts",
        );
        expect(readFileSync(join(project, "fixtures.ts"), "utf8")).toContain(
          "export default",
        );

        // The README quickstart against the tarball: init's scaffolded
        // fixtures flow through discovery and injection.
        writeFileSync(
          join(project, "quickstart.test.ts"),
          `import { test, expect } from "bun-fixture";
test("quickstart: scaffolded fixtures inject", async ({ config, tmpDir }) => {
  expect(config).toEqual({ env: "test" });
  expect(typeof tmpDir).toBe("string");
  expect(tmpDir.length).toBeGreaterThan(0);
});
`,
        );
        const output = run([BUN, "test"], project);
        expect(output).toContain("1 pass");
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

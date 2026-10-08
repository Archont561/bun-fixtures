/**
 * ADR 0024 installed-consumer boundary for global snapshot serializers.
 *
 * Packs the publishable package, installs the tarball into a scratch project,
 * preloads a module that registers a global serializer through the public
 * `@archont561/bun-test-utils/snap` subpath, runs a root `bun-test-utils` snapshot test,
 * and verifies the generated snapshot — the exact flow task_005 criterion 5
 * re-runs against the registry package after publication.
 */

import {
  existsSync,
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
const PACKAGE_NAME = "@archont561/bun-test-utils";
/** npm folds the scope into the tarball name: `@scope/name` packs to `scope-name-<version>.tgz`. */
const TARBALL_NAME = "archont561-bun-test-utils";

interface RunResult {
  exitCode: number;
  output: string;
}

function spawn(cmd: string[], cwd?: string): RunResult {
  const proc = Bun.spawnSync({
    cmd,
    cwd,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      // Deterministic in every environment: CI would otherwise select "ci"
      // mode, which refuses to record the first snapshot.
      SNAPSHOT_MODE: "match",
    },
  });
  // stdout + stderr, which is where `bun test` splits its reporting.
  return {
    exitCode: proc.exitCode,
    output: `${proc.stdout.toString()}${proc.stderr.toString()}`,
  };
}

function run(cmd: string[], cwd?: string): string {
  const { exitCode, output } = spawn(cmd, cwd);
  if (exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed (${exitCode}):\n${output}`);
  }
  return output;
}

describe("installed-consumer snapshot serializer preload", () => {
  test(
    "a packed install applies a global serializer from @archont561/bun-test-utils/snap to a root snapshot test",
    () => {
      const packDir = mkdtempSync(join(tmpdir(), "bun-test-utils-pack-snap-"));
      const project = mkdtempSync(
        join(tmpdir(), "bun-test-utils-snap-consumer-"),
      );
      try {
        // Pack and install the publishable tarball — not the workspace source.
        const tgz = join(packDir, `${TARBALL_NAME}.tgz`);
        run(
          [BUN, "pm", "pack", "--quiet", "--ignore-scripts", "--filename", tgz],
          PACKAGE_DIR,
        );
        writeFileSync(
          join(project, "package.json"),
          JSON.stringify({ name: "snap-consumer", type: "module" }),
        );
        run([BUN, "add", tgz], project);
        expect(
          existsSync(
            join(project, "node_modules", PACKAGE_NAME, "dist", "snap.js"),
          ),
          "the installed package exposes dist/snap.js for the ./snap subpath",
        ).toBe(true);

        // The documented consumer flow: a preload module registering a global
        // serializer through the public subpath.
        writeFileSync(
          join(project, "test-serializers.ts"),
          `import { createSnapshotSerializer } from "@archont561/bun-test-utils/snap";\n` +
            `\n` +
            `createSnapshotSerializer((value) =>\n` +
            `  value instanceof Date ? "<date>" : undefined,\n` +
            `);\n`,
        );
        // The standard engine preload plus the serializer preload.
        writeFileSync(
          join(project, "bunfig.toml"),
          `[test]\n` +
            `preload = ["./node_modules/${PACKAGE_NAME}/dist/plugin.js", "./test-serializers.ts"]\n`,
        );

        // A root bun-test-utils test: the snapshot fixture is on the root
        // test context, and the Date sits nested inside the matched value.
        writeFileSync(
          join(project, "app.test.ts"),
          `import { test } from "@archont561/bun-test-utils";\n` +
            `\n` +
            `test("renders the widget", ({ snapshot }) => {\n` +
            `  snapshot.match({ at: new Date(0), label: "widget" });\n` +
            `});\n`,
        );

        // First run records the snapshot through the global serializer.
        const first = run([BUN, "test"], project);
        expect(first).toContain("1 pass");
        expect(first).toContain("0 fail");

        const snapPath = join(
          project,
          "__snapshots__",
          "renders-the-widget.snap.json",
        );
        expect(existsSync(snapPath), "snapshot file was generated").toBe(true);
        const stored = JSON.parse(readFileSync(snapPath, "utf8"));
        // The global serializer ran — including for the nested Date. The
        // built-in JSON path would have stored an ISO-8601 string instead.
        expect(stored.value).toBe(
          '{\n  "at": "<date>",\n  "label": "widget"\n}',
        );

        // Second run compares against the stored snapshot instead of
        // rewriting it.
        const second = run([BUN, "test"], project);
        expect(second).toContain("1 pass");
        expect(second).toContain("0 fail");

        // The stored snapshot is load-bearing: corrupting it fails the run
        // with a mismatch naming both values.
        stored.value = '{\n  "at": "<tampered>",\n  "label": "widget"\n}';
        writeFileSync(snapPath, JSON.stringify(stored));
        const tampered = spawn([BUN, "test"], project);
        expect(tampered.exitCode).not.toBe(0);
        expect(tampered.output).toContain('Snapshot "value" mismatch');
        expect(tampered.output).toContain("<tampered>");
        expect(tampered.output).toContain("<date>");
      } finally {
        rmSync(packDir, { recursive: true, force: true });
        rmSync(project, { recursive: true, force: true });
      }
    },
    { timeout: 180_000 },
  );
});

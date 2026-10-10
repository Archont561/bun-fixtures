/**
 * ADR 0024 installed-consumer boundary for cassette callback serializers
 * (task_077; spec 0012 R9, ADR 0034).
 *
 * Packs the publishable package, installs the tarball into a scratch project,
 * preloads a module that defines a reversible `CallbackSerializer` and the
 * custom class it claims, and runs a root `bun-test-utils` cassette test that
 * registers the serializer fixture-locally and round-trips a callback result
 * whose value mixes built-in shapes (`Date`, `Map`, `BigInt`) with the custom
 * class. The replay's `calls` counter proves the second invocation did not
 * execute the callback — the analogue of task_057's stored-snapshot tampering
 * proof, adapted to the in-memory per-test cassette contract (ADR 0034 §8).
 * This is the exact flow task_005 criterion 5 re-runs against the registry
 * package after publication.
 */

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
      // The in-memory cassette contract only exercises record/replay, but
      // an ambient `VCR_MODE=replay` from the caller would skip the
      // `record()` callback. Pin to `record` so the round-trip is real.
      VCR_MODE: "record",
    },
  });
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

describe("installed-consumer cassette serializer preload", () => {
  test(
    "a packed install applies a /vcr-defined callback serializer and the root cassette round-trips built-in plus custom values",
    () => {
      const packDir = mkdtempSync(join(tmpdir(), "bun-test-utils-pack-vcr-"));
      const project = mkdtempSync(
        join(tmpdir(), "bun-test-utils-vcr-consumer-"),
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
          JSON.stringify({ name: "vcr-consumer", type: "module" }),
        );
        run([BUN, "add", tgz], project);
        expect(
          existsSync(
            join(project, "node_modules", PACKAGE_NAME, "dist", "vcr.js"),
          ),
          "the installed package exposes dist/vcr.js for the ./vcr subpath",
        ).toBe(true);

        // The documented consumer flow: a preload module that defines the
        // custom class and a reversible `CallbackSerializer` through the
        // public `/vcr` subpath. Registration is fixture-local (ADR 0034 §5),
        // so the preload only constructs the definition; the consumer test
        // registers it via `cassette.addSerializer(...)`. The class is
        // exported so the consumer test can construct the same Token
        // instance the serializer claims via `instanceof`. If the subpath is
        // broken or the named export is missing, this preload throws at
        // module load and the consumer test fails to start.
        writeFileSync(
          join(project, "test-serializers.ts"),
          `import { defineCallbackSerializer } from "@archont561/bun-test-utils/vcr";\n` +
            `\n` +
            `export class Token {\n` +
            `  constructor(readonly value: string) {}\n` +
            `}\n` +
            `\n` +
            `export const tokenSerializer = defineCallbackSerializer<Token>({\n` +
            `  name: "token",\n` +
            `  version: 1,\n` +
            `  test: (candidate) => candidate instanceof Token,\n` +
            `  serialize: (token) => ({ value: token.value }),\n` +
            `  deserialize: (data) => new Token((data as { value: string }).value),\n` +
            `});\n`,
        );
        // The standard engine preload plus the serializer preload.
        writeFileSync(
          join(project, "bunfig.toml"),
          `[test]\n` +
            `preload = ["./node_modules/${PACKAGE_NAME}/dist/plugin.js", "./test-serializers.ts"]\n`,
        );

        // A root bun-test-utils test: the cassette fixture is on the root
        // test context, the custom serializer is registered fixture-locally,
        // and the callback's result mixes built-in shapes (Date / Map /
        // BigInt) with a Token the custom serializer claims. The same
        // closure is passed to record and replay, so replay hits the
        // recorded-object path and `calls` stays at 1.
        writeFileSync(
          join(project, "app.test.ts"),
          `import { expect, test } from "@archont561/bun-test-utils";\n` +
            `import { Token, tokenSerializer } from "./test-serializers.ts";\n` +
            `\n` +
            `test("cassette round-trips built-in and custom serializer values", async ({ cassette }) => {\n` +
            `  cassette.addSerializer(tokenSerializer);\n` +
            `  const value = () => ({\n` +
            `    at: new Date(0),\n` +
            `    roles: new Map([["admin", true]]),\n` +
            `    balance: 10n,\n` +
            `    token: new Token("t-1"),\n` +
            `  });\n` +
            `  let calls = 0;\n` +
            `  const load = () => {\n` +
            `    calls++;\n` +
            `    return value();\n` +
            `  };\n` +
            `  expect(await cassette.record(load)).toEqual(value());\n` +
            `  expect(calls).toBe(1);\n` +
            `  const replayed = await cassette.replay(load);\n` +
            `  expect(replayed).toEqual(value());\n` +
            `  expect(calls).toBe(1);\n` +
            `});\n`,
        );

        const output = run([BUN, "test"], project);
        // The consumer test must pass: it is the proof the subpath import
        // + defineCallbackSerializer + cassette.addSerializer + record +
        // replay round-trip all wired through the packed tarball.
        expect(output).toContain(
          "cassette round-trips built-in and custom serializer values",
        );
        expect(output).toContain("1 pass");
        expect(output).toContain("0 fail");
      } finally {
        rmSync(packDir, { recursive: true, force: true });
        rmSync(project, { recursive: true, force: true });
      }
    },
    { timeout: 180_000 },
  );
});

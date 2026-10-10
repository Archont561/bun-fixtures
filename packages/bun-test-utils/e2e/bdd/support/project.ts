/**
 * Scratch-project harness for the behavioural (Gherkin) suite, also used by
 * `e2e/style-matrix.test.ts` for the cells whose fixtures follow the
 * file-based conventions (`__snapshots__/`, `__cassettes__/`).
 *
 * Every scenario gets a real, throwaway Bun project with `@archont561/bun-test-utils`
 * installed, so the behaviour under test is what an actual user sees:
 * explicit fixture composition, `bun test` output, exit codes — no internals poked.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

/** Published wrapper package root — used as the consumer install target. */
export const PACKAGE_ROOT = resolve(import.meta.dir, "..", "..", "..");

/** The Bun binary currently running this suite. */
const BUN = process.execPath;

export interface RunResult {
  stdout: string;
  stderr: string;
  /** stdout + stderr, which is where `bun test` splits its reporting. */
  output: string;
  exitCode: number | null;
}

export interface Project {
  dir: string;
}

/** Creates a scratch project with `bunfig.toml` preloading bun-test-utils teardown hooks. */
export function createProject(): Project {
  const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-bdd-"));
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  mkdirSync(join(dir, "node_modules", "@archont561"), { recursive: true });
  symlinkSync(
    PACKAGE_ROOT,
    join(dir, "node_modules", "@archont561", "bun-test-utils"),
  );
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "scratch", type: "module" }, null, 2),
  );
  writeFileSync(
    join(dir, "bunfig.toml"),
    '[test]\npreload = ["./node_modules/@archont561/bun-test-utils/dist/plugin.js"]\n',
  );
  return { dir };
}

/** Creates a scratch project with no bunfig.toml — for the `init` scenarios. */
export function createBareProject(): Project {
  const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-bdd-"));
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  mkdirSync(join(dir, "node_modules", "@archont561"), { recursive: true });
  symlinkSync(
    PACKAGE_ROOT,
    join(dir, "node_modules", "@archont561", "bun-test-utils"),
  );
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "scratch", type: "module" }, null, 2),
  );
  return { dir };
}

export function writeProjectFile(
  project: Project,
  relPath: string,
  contents: string,
): void {
  const full = join(project.dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents.endsWith("\n") ? contents : `${contents}\n`);
}

export function readProjectFile(project: Project, relPath: string): string {
  return readFileSync(join(project.dir, relPath), "utf8");
}

export function projectFileExists(project: Project, relPath: string): boolean {
  return existsSync(join(project.dir, relPath));
}

function run(
  project: Project,
  cmd: string[],
  env: Record<string, string | undefined> = {},
): RunResult {
  // An undefined overlay value removes the variable for this run only.
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries({
    ...process.env,
    FORCE_COLOR: "0",
    ...env,
  })) {
    if (value !== undefined) childEnv[key] = value;
  }
  const proc = Bun.spawnSync({ cmd, cwd: project.dir, env: childEnv });
  const stdout = proc.stdout.toString();
  const stderr = proc.stderr.toString();
  return { stdout, stderr, output: stdout + stderr, exitCode: proc.exitCode };
}

/**
 * Runs `bun test` inside the scratch project. `env` overlays the inherited
 * environment for this run only, so a scenario can run the same project twice
 * in different modes.
 */
export function runTests(
  project: Project,
  env: Record<string, string> = {},
): RunResult {
  // CI and VCR_MODE are cleared unless a scenario sets them, so a CI runner's
  // own environment cannot change what a scenario means (ADR 0036).
  return run(project, [BUN, "test"], {
    CI: undefined,
    VCR_MODE: undefined,
    ...env,
  });
}

/** Runs the bun-test-utils CLI inside the scratch project. */
export function runCli(project: Project, args: string[]): RunResult {
  return run(project, [BUN, join(PACKAGE_ROOT, "src", "cli.ts"), ...args], {
    CI: undefined,
  });
}

export function removeProject(project: Project): void {
  rmSync(project.dir, { recursive: true, force: true });
}

/** Number of non-overlapping occurrences of `needle` in `haystack`. */
export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

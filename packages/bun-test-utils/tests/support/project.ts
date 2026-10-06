/**
 * Scratch-project harness for the behavioural (Gherkin) suite.
 *
 * Every scenario gets a real, throwaway Bun project with `bun-test-utils`
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

/** Repository root — `tests/support/..` */
export const REPO_ROOT = resolve(import.meta.dir, "..", "..");

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
  symlinkSync(REPO_ROOT, join(dir, "node_modules", "bun-test-utils"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "scratch", type: "module" }, null, 2),
  );
  writeFileSync(
    join(dir, "bunfig.toml"),
    '[test]\npreload = ["./node_modules/bun-test-utils/dist/plugin.js"]\n',
  );
  return { dir };
}

/** Creates a scratch project with no bunfig.toml — for the `init` scenarios. */
export function createBareProject(): Project {
  const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-bdd-"));
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  symlinkSync(REPO_ROOT, join(dir, "node_modules", "bun-test-utils"));
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
  env: Record<string, string> = {},
): RunResult {
  const proc = Bun.spawnSync({
    cmd,
    cwd: project.dir,
    env: { ...process.env, FORCE_COLOR: "0", ...env },
  });
  const stdout = proc.stdout.toString();
  const stderr = proc.stderr.toString();
  return { stdout, stderr, output: stdout + stderr, exitCode: proc.exitCode };
}

/** Runs `bun test` inside the scratch project. */
export function runTests(project: Project): RunResult {
  return run(project, [BUN, "test"]);
}

/** Runs the bun-test-utils CLI inside the scratch project. */
export function runCli(project: Project, args: string[]): RunResult {
  return run(project, [BUN, join(REPO_ROOT, "src", "cli.ts"), ...args]);
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

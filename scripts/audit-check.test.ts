/**
 * Characterization test for the CI audit gate (`scripts/audit-check.ts`,
 * task_081).
 *
 * The gate is git-diff based and audits the tree it runs in, so a fixture that
 * contained a work marker would trip the very gate under test. Every fixture
 * here lives in a throwaway repository under `os.tmpdir()`, and the marker is
 * assembled at runtime. No marker literal exists anywhere in the repository.
 *
 * The contract pinned here is the one the port (task_079) preserved: additions
 * only, the `+++` header filter, the merge-base diff, the three-step base order,
 * and the public-API exit code passed straight through.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const AUDIT = join(REPO_ROOT, "scripts", "audit-check.ts");
const PUBLIC_API = join(REPO_ROOT, "scripts", "public-api.ts");

/** Assembled at runtime so the literal never appears in the tree. */
const MARKER = ["TO", "DO:"].join("");
const HEADER_MARKER_LINE = "== audit: TODO/FIXME additions";
const HIT_LINE = "::error::TODO/FIXME added";
const API_HEADER = "== audit: public API surface";

const tempRoots: string[] = [];

afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

interface Run {
  stdout: string;
  stderr: string;
  code: number;
}

/** Run git in `cwd`, failing loudly on a non-zero exit. */
function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(
    [
      "git",
      "-c",
      "user.name=audit-test",
      "-c",
      "user.email=audit-test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString().trim();
}

/**
 * A fresh, empty repository on `main`. Nothing is copied in: the gate and the
 * public-API step both resolve their scripts from the repository they live in,
 * whatever the working directory is.
 */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "audit-check-"));
  tempRoots.push(dir);
  git(dir, "init", "-q", "-b", "main");
  return dir;
}

function write(repo: string, path: string, content: string): void {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

function commit(repo: string, message: string): void {
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "--allow-empty", "-m", message);
}

/** Run the audit gate with `repo` as cwd and the CI base variable cleared. */
async function audit(
  repo: string,
  args: string[] = [],
  env: Record<string, string> = {},
): Promise<Run> {
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "GITHUB_BASE_REF") childEnv[key] = value;
  }
  Object.assign(childEnv, env);
  const proc = Bun.spawn([process.execPath, AUDIT, ...args], {
    cwd: repo,
    env: childEnv,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr, code: await proc.exited };
}

/** The public-API step's own exit code, run directly from the same cwd. */
async function publicApiExitCode(repo: string): Promise<number> {
  const proc = Bun.spawn([process.execPath, PUBLIC_API], {
    cwd: repo,
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  return proc.exitCode ?? -1;
}

describe("marker gate — additions only", () => {
  test("fires on an added marker line and exits 1 without reaching the API step", async () => {
    const repo = makeRepo();
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "base");
    write(
      repo,
      "packages/a.ts",
      `export const a = 1;\n// ${MARKER} finish later\n`,
    );
    commit(repo, "add marker");

    const run = await audit(repo, ["HEAD~1"]);
    expect(run.code).toBe(1);
    expect(run.stdout).toContain(HEADER_MARKER_LINE);
    expect(run.stdout).toContain(HIT_LINE);
    expect(run.stdout).toContain(`+// ${MARKER} finish later`);
    expect(run.stdout).not.toContain("clean");
    expect(run.stdout).not.toContain(API_HEADER);
  });

  test("stays silent when a marker line is removed", async () => {
    const repo = makeRepo();
    write(
      repo,
      "packages/a.ts",
      `export const a = 1;\n// ${MARKER} finish later\n`,
    );
    commit(repo, "base with marker");
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "remove marker");

    const run = await audit(repo, ["HEAD~1"]);
    expect(run.stdout).toContain("clean");
    expect(run.stdout).not.toContain(HIT_LINE);
    expect(run.stdout).toContain(API_HEADER);
  });

  test("a pre-existing marker on an unchanged line stays grandfathered", async () => {
    const repo = makeRepo();
    write(repo, "packages/a.ts", `// ${MARKER} old\nexport const a = 1;\n`);
    commit(repo, "base with marker");
    write(repo, "packages/a.ts", `// ${MARKER} old\nexport const a = 2;\n`);
    commit(repo, "touch other line");

    const run = await audit(repo, ["HEAD~1"]);
    expect(run.stdout).toContain("clean");
    expect(run.stdout).not.toContain(HIT_LINE);
  });
});

describe("marker gate — diff filtering", () => {
  test("the +++ file header is not content, even when a path contains the marker", async () => {
    const repo = makeRepo();
    write(repo, "packages/base.ts", "export {};\n");
    commit(repo, "base");
    // The `+++ b/packages/<name>` header carries the marker; no added line does.
    write(repo, `packages/${MARKER}notes.ts`, "export const n = 0;\n");
    commit(repo, "marker in path only");

    const run = await audit(repo, ["HEAD~1"]);
    expect(run.stdout).toContain("clean");
    expect(run.stdout).not.toContain(HIT_LINE);
  });

  test("only the audited paths are diffed", async () => {
    const repo = makeRepo();
    write(repo, "README.md", "# repo\n");
    commit(repo, "base");
    write(repo, "README.md", `# repo\n\n${MARKER} outside the audited paths\n`);
    commit(repo, "marker in README");

    const run = await audit(repo, ["HEAD~1"]);
    expect(run.stdout).toContain("clean");
    expect(run.stdout).not.toContain(HIT_LINE);
  });
});

describe("marker gate — every audited path", () => {
  for (const path of [
    "packages/x.ts",
    "apps/x.ts",
    "scripts/x.ts",
    ".github/x.yml",
  ]) {
    test(`fires on an added marker under ${path.split("/")[0]}/`, async () => {
      const repo = makeRepo();
      write(repo, "README.md", "# repo\n");
      commit(repo, "base");
      write(repo, path, `# ${MARKER} audited\n`);
      commit(repo, "marker under audited path");

      const run = await audit(repo, ["HEAD~1"]);
      expect(run.code).toBe(1);
      expect(run.stdout).toContain(HIT_LINE);
    });
  }
});

describe("marker gate — merge-base diff", () => {
  test("uncommitted edits are audited", async () => {
    const repo = makeRepo();
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "base");
    write(
      repo,
      "packages/a.ts",
      `export const a = 1;\n// ${MARKER} unstaged\n`,
    );

    const run = await audit(repo, ["HEAD"]);
    expect(run.code).toBe(1);
    expect(run.stdout).toContain(HIT_LINE);
    expect(run.stdout).toContain(`+// ${MARKER} unstaged`);
  });

  test("a branch behind its base is not blamed for the base removing a marker", async () => {
    const repo = makeRepo();
    write(
      repo,
      "packages/a.ts",
      `// ${MARKER} grandfathered at the fork\nexport const a = 1;\n`,
    );
    commit(repo, "fork point");
    git(repo, "checkout", "-q", "-b", "feature");
    write(repo, "packages/b.ts", "export const b = 1;\n");
    commit(repo, "feature work");
    git(repo, "checkout", "-q", "main");
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "main removes the marker");
    git(repo, "checkout", "-q", "feature");

    // A two-dot diff against main would show the marker as re-added on the
    // branch. The merge-base diff sees only the branch's own additions.
    const run = await audit(repo, ["main"]);
    expect(run.stdout).toContain("diff vs main");
    expect(run.stdout).toContain("clean");
    expect(run.stdout).not.toContain(HIT_LINE);
  });
});

describe("base resolution — three-step order", () => {
  test("an explicit argument wins, and is named in the header", async () => {
    const repo = makeRepo();
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "one");
    write(repo, "packages/a.ts", "export const a = 2;\n");
    commit(repo, "two");

    const run = await audit(repo, ["HEAD~1"], { GITHUB_BASE_REF: "main" });
    expect(run.stdout).toContain(`${HEADER_MARKER_LINE} (diff vs HEAD~1)`);
  });

  test("GITHUB_BASE_REF selects origin/<base>, fetched from origin", async () => {
    const repo = makeRepo();
    const bare = mkdtempSync(join(tmpdir(), "audit-origin-"));
    tempRoots.push(bare);
    git(bare, "init", "-q", "--bare", "-b", "main");
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "base");
    git(repo, "remote", "add", "origin", bare);
    git(repo, "push", "-q", "origin", "main");
    write(
      repo,
      "packages/a.ts",
      `export const a = 1;\n// ${MARKER} on the PR\n`,
    );
    commit(repo, "pr change");

    const run = await audit(repo, [], { GITHUB_BASE_REF: "main" });
    expect(run.stdout).toContain(`${HEADER_MARKER_LINE} (diff vs origin/main)`);
    expect(run.stdout).toContain(HIT_LINE);
  });

  test("with no argument and no GITHUB_BASE_REF, HEAD~1 is the base", async () => {
    const repo = makeRepo();
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "one");
    write(repo, "packages/a.ts", "export const a = 2;\n");
    commit(repo, "two");

    const run = await audit(repo);
    expect(run.stdout).toContain(`${HEADER_MARKER_LINE} (diff vs HEAD~1)`);
    expect(run.stdout).toContain("clean");
  });

  test("a single-commit clone audits nothing and says so on stderr", async () => {
    // The shallow-clone trap from the session report: HEAD~1 does not resolve,
    // so the gate reports clean with a git error on stderr. Pinned so that
    // behaviour is a recorded choice, not an accident.
    const repo = makeRepo();
    write(repo, "packages/a.ts", `// ${MARKER} the only commit\n`);
    commit(repo, "only");

    const run = await audit(repo);
    expect(run.stderr).toContain("HEAD~1");
    expect(run.stdout).toContain("clean");
  });

  test("an unresolvable base falls back to the base string and is not a gate failure", async () => {
    const repo = makeRepo();
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "base");

    const run = await audit(repo, ["no-such-ref"]);
    expect(run.stderr.length).toBeGreaterThan(0);
    expect(run.stdout).toContain("clean");
  });
});

describe("public-API step — resolution and exit code passthrough", () => {
  test("resolves scripts/public-api.ts from the script's own location, not the cwd", async () => {
    // The temp repo has no scripts/public-api.ts. A cwd-relative call fails
    // with `Module not found`; the absolute path reaches the real script.
    const repo = makeRepo();
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "base");
    write(repo, "packages/a.ts", "export const a = 2;\n");
    commit(repo, "change");

    const run = await audit(repo, ["HEAD~1"]);
    expect(run.stdout).toContain(API_HEADER);
    expect(run.stderr).not.toContain("Module not found");
    expect(run.stderr).not.toContain("public-api.ts");
  });

  test("a clean marker gate hands the public-API exit code straight through", async () => {
    // Equality only: the code depends on whether `dist/` is built, and both
    // runs see the same tree, so they must agree whichever it is.
    const repo = makeRepo();
    write(repo, "packages/a.ts", "export const a = 1;\n");
    commit(repo, "base");
    write(repo, "packages/a.ts", "export const a = 2;\n");
    commit(repo, "change");

    const run = await audit(repo, ["HEAD~1"]);
    const direct = await publicApiExitCode(repo);
    expect(run.stdout).toContain(API_HEADER);
    expect(run.code).toBe(direct);
  });
});

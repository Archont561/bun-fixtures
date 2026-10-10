#!/usr/bin/env bun

/**
 * CI audit check (audit 2026-10-06, deferred item; task_062; ported from
 * `scripts/audit-check.sh` to TypeScript in task_079 — same gates, same
 * output, same exit codes).
 *
 * Two gates over the change under review:
 *
 *   1. No TODO/FIXME additions — unfinished work belongs in the Backlog with a
 *      task description, not in comments the compiler ignores.
 *   2. Public API surface unchanged against scripts/public-api.txt — a move
 *      must be deliberate and regenerated (`bun run audit:api`).
 *
 * The diff base is, in order: the first argument; `origin/$GITHUB_BASE_REF` on
 * pull requests; `HEAD~1` otherwise. Exits non-zero on the first violated gate.
 */

import { join } from "node:path";
import { $, type ShellExpression } from "bun";

/** Paths the marker gate audits, relative to the repository root. */
const DIFF_PATHS = ["packages", "apps", "scripts", ".github"];

/**
 * A real work marker is the word in caps, directly followed by a colon (the
 * universal convention). The colon is what keeps this gate from tripping on
 * prose about the marker policy — including the text of this regex, whose
 * alternation group sits between the word and the colon.
 */
const MARKER = /\b(TODO|FIXME):/;

/**
 * Run `git`, capturing stdout and stderr instead of echoing them. The shell
 * never throws on a non-zero status: the original gave every git call its own
 * verdict (`2>/dev/null`, `|| true`, `set -e`), so each call site below says
 * for itself what it does with `code` and `err`.
 */
async function git(
  args: ShellExpression[],
): Promise<{ out: string; err: string; code: number }> {
  const { stdout, stderr, exitCode } = await $`git ${args}`.nothrow().quiet();
  return {
    // `$( )` in the shell original dropped trailing newlines; so does this.
    out: stdout.toString().replace(/\n+$/, ""),
    err: stderr.toString(),
    code: exitCode,
  };
}

// `cd "$(git rev-parse --show-toplevel)"`: git's complaint stayed on the
// terminal, and an empty result left `cd` a no-op in the current directory.
const toplevel = await git(["rev-parse", "--show-toplevel"]);
if (toplevel.err !== "") process.stderr.write(toplevel.err);
if (toplevel.out !== "") process.chdir(toplevel.out);

let base = process.argv[2] ?? "";
if (base === "") {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: this script is not a Turbo task — it reads the PR context straight from the CI environment, so there is no task `env` list it should be declared in.
  const prBase = process.env.GITHUB_BASE_REF;
  if (prBase) {
    // `>/dev/null 2>&1 || true` — a failed fetch is not this gate's problem.
    await git(["fetch", "--no-tags", "origin", prBase]);
    base = `origin/${prBase}`;
  } else {
    base = "HEAD~1";
  }
}
// Diff against the merge base rather than $BASE...HEAD so locally staged or
// unstaged edits are audited too — the gate runs pre-push, not only in CI.
// `2>/dev/null || echo "$BASE"`: an unresolvable base falls back to the base.
const mergeBase = await git(["merge-base", base, "HEAD"]);
const since = mergeBase.code === 0 ? mergeBase.out : base;

console.log(`== audit: TODO/FIXME additions (diff vs ${base})`);
// The original piped `git diff` into grep, so git's own message reached the
// terminal even though `|| true` swallowed its status. Keep that: a gate that
// silently audits nothing is worse than one that fails.
const diff = await git(["diff", since, "--", ...DIFF_PATHS]);
if (diff.err !== "") process.stderr.write(diff.err);
// Added lines only, so pre-existing markers stay grandfathered; `+++` is the
// diff's own file header, not content.
const hits = diff.out
  .split("\n")
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .filter((line) => MARKER.test(line))
  .join("\n");
if (hits !== "") {
  console.log(
    "::error::TODO/FIXME added — finish the work or record it in the Backlog instead:",
  );
  console.log(hits);
  process.exit(1);
}
console.log("clean");

console.log("== audit: public API surface");
// The second gate is scripts/public-api.ts, unchanged: it owns its output and
// its exit code, so the status is handed straight through. It is resolved from
// this script's own directory, not the cwd, so the gate runs the same from any
// working directory (task_083).
const publicApi = join(import.meta.dir, "public-api.ts");
const api = await $`${process.execPath} ${publicApi}`.nothrow();
process.exit(api.exitCode);

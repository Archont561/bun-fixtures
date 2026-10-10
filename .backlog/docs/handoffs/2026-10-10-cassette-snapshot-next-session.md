# Next session: cassette and snapshot fixtures

Handoff from the 2026-10-10 session. Paste this as the opening prompt of the next session.

---

You are continuing work on `Archont561/bun-test-utils`. Work on the session branch Arena gives you. Never switch to, create, or push to another branch. Do every change through a PR from that branch. Do not merge unless the user asks.

## Context

The repository was repositioned as a general-purpose test extension for `bun test`, with Playwright-style typed fixtures composed by `test.extend()` and capability packs (BDD, property-based testing, snapshots, HTTP cassettes, browser testing). This is recorded in ADR 0038 and merged in PR #59. The follow-up backlog tasks are merged too.

Two capabilities are next:

- **Cassettes.** The fixture is an object (`record`, `replay`, `addSerializer`, `mode`, `path`, `entries`, `save`, `load`, `redactHeader`).
- **Snapshots.** The fixture is an object (`match`, `matchFile`, `addSerializer`, `setMode`, `mode`, `path`).

The user asked for these shapes:

- `cassette(fn)`: a get-or-record wrapper. It is callable and keeps the object methods.
- `snapshot(fn, name)`: runs `fn`, matches the result under `name`, and returns the result. It never caches and does not key on the function body.
- Global callback serializer registration on `/vcr`, mirroring `/snap`.

## Tasks, in order

| Task | Priority | Summary |
|---|---|---|
| `task_095` | P1 | Bug: `cassette.record(fn)` keeps the old sidecar entry after a body edit and does not store the new one. ADR 0035 D2.1 says the next record run must drop it. Fix it first. Regression test plus behavioural scenario. |
| `task_096` | P1 | ADR for `cassette(fn)`. It must supersede or keep the ADR 0036 stale-cache rule explicitly. |
| `task_097` | P1 | Implement `cassette(fn)` after `task_096` is accepted. |
| `task_098` | P2 | `registerCallbackSerializer` on `/vcr`, plus an unregister counterpart. |
| `task_099` | P2 | `snapshot(fn, name)`. Small ADR or spec amendment first. |

Run `bunx backlog task show <id>` for each task's full acceptance criteria.

## Facts already verified

These came from running the consumer probes. Re-check them before relying on them.

- `cassette.record(fn)` always runs `fn`. It never reads the disk. A second run runs the callback again.
- `cassette.replay(fn)` reads the sidecar across runs, matching on exact source text. It returns the stored result when the body is unchanged.
- A changed body makes `replay` throw `CALLBACK_NOT_RECORDED`. The message names the sidecar path.
- After a body edit, `record` keeps the old entry and does not write the new one. This is the `task_095` bug.
- Cassette HTTP matching is exact on method and full URL, including the port. A recording against `testServer` (ephemeral port) does not replay on the next run. The docs say so. Changing this is a separate decision.
- `stdio` captures `process.stdout.write` and `process.stderr.write` only. It does not capture `console.*`.
- `seed` does not report the seed on failure.
- `snapshot` compares an output with a stored baseline. It does not look at the code that produced it. A changed body with the same output passes.

## Conflicts you must resolve in the ADR

- **ADR 0036** says a stale cache "fails with the exact clear command, not with a silent re-record or an appended episode". The wrapper's edited-body rule, which re-records on a miss, conflicts with that. Either supersede that rule for the wrapper in `auto` mode and say what replaces it, or keep the error and make `cassette(fn)` a thin layer over `replay`/`record`. If it re-records, it must log so the re-record is never silent.
- **ADR 0027 rule 3** says `record` always runs an unrecorded object. The wrapper must not change `record`.
- **Serializer version mismatch.** Recordings store the serializer name and version. Decide whether a mismatch is a miss in `auto` and an error in CI, or always an error.
- **Source text as a key.** It does not see captured variables or imported helpers. Decide what the ADR says about that, and whether the wrapper takes an explicit version argument.

## Rules that stay in force

- An ADR is accepted before any implementation of a design change. Mark any superseded ADR.
- Public API changes need the README, the matching spec in `.backlog/docs/specs/`, the docs under `apps/docs`, and `scripts/public-api.txt` updated in the same PR. `bun run audit:api` is an update command, so check `git diff -- scripts/public-api.txt` afterwards.
- Do not touch `.github/workflows/*`.
- Do not rewrite history: ADRs 0001, 0002, 0006, 0008, 0011, spec 0002 line 47, `caveats.md`, milestone M2.
- No tags, releases, npm publishes, or `auto-release` dispatches.
- `task_090` stays `in_progress`. `task_066` and `task_005` stay open until v0.1.0 is on npm.
- No changeset until 0.1.0 is cut.
- Claim touched paths before committing: `mkdir -p .backlog/claims/active .backlog/claims/archive`, then `bunx backlog claim start --topic "..." --agent arena-agent --path <paths>`. Claims are enforced on commit.
- Merges to `main` run `publish-sandbox.yml`. That publishes the sandbox bundle. It is routine, but it runs on every merge.
- The lefthook hooks call `bunx`. Put the tool directory on `PATH` before committing or pushing, or the hooks fail.

## Setup

```bash
export PATH=/home/user/.tools/bin:/home/user/.local/bin:$PATH
npm i -g --prefix /home/user/.tools bun@1.4.2   # if bun is missing
bun install --frozen-lockfile
sh scripts/restore.sh                            # pixi warnings are expected
bun run install-browsers:sandbox
```

## Gates before opening a PR

```bash
bun run build
bun run lint
bun run typecheck
bun test
bun run docs:build
bun run audit:api     # then: git diff -- scripts/public-api.txt
```

Baseline at the end of this session: `bun test` gave 648 pass, 2 skip, 0 fail. Re-measure it at the start. New tests will change the counts.

## Done means

- The ADR for the wrapper is accepted, and any superseded ADR is marked.
- `task_095` is fixed, with a regression test.
- The wrapper, the serializer registration, and the snapshot callable are implemented, or the tasks are explicitly deferred with a reason.
- Tests, docs, the spec, and `public-api.txt` agree.
- All gates pass, and the PR is open from the session branch to `main`.
- Report the PR URL and what was deferred.

# 0036 — Auto cassette mode and explicit cache clearing for cassettes and snapshots

- **Status:** accepted, amended by 0039 for local `cassette(fn)` callback misses only (2026-10-10: committed storage, auto as the default, `cache clear` by test file, fail with a hint on a cache miss)
- **Date:** 2026-10-10

> **Amendment (2026-10-10, during implementation):** the package binary is `test-utils`, the same name `init` uses (`packages/bun-test-utils/package.json` `bin`). Every `bunx test-utils cache clear` in this ADR means `bunx test-utils cache clear`. No second binary is added.
>
> **Amendment (2026-10-10, ADR 0039):** decision 4's no-silent-re-record rule remains binding for HTTP requests, direct `cassette.replay(callback)`, explicit replay, and CI. [ADR 0039](./0039-cassette-get-or-record-wrapper.md) supersedes it only for a local `auto` callback-source miss through the explicit `cassette(fn)` wrapper: that wrapper records, replaces the sidecar's stale entries, and emits a warning. It does not append an HTTP response or change the HTTP cache-clear rule.

## Context

Three facts about the current code shape this decision.

1. **Cassettes default to always-record.** `VCR_MODE` defaults to `record`
   (`packages/vcr/src/cassette.ts`). Every run hits the network, and the cassette is
   overwritten at teardown whenever it has entries. `replay` requires the file to exist
   and throws `CASSETTE_NOT_FOUND` otherwise. Nothing gives a "record once, then replay"
   behaviour.
2. **Snapshots already record on first use.** `SNAPSHOT_MODE` defaults to `match`
   outside CI: a missing snapshot is recorded instead of failing. `ci` never creates a
   snapshot. Nothing clears them. Deleting `__snapshots__/` by hand is the only reset.
3. **There is no reset surface.** The `bun-test-utils` CLI has only `init`. The fixture
   context carries `testFile` and `testName` and no describe-block path, so "suite"
   cannot be recovered at runtime.

The docs (`apps/docs/.../snapshot-testing.md`) tell users to commit `__snapshots__/`,
and the repository commits none of its own recordings. The ADR 0035 sidecar
(`<test>.callbacks.json`) is accepted but not yet implemented. Auto mode has to cover it too.

## Decision

**Cassettes gain an `auto` mode that is the default. It records a test's cassette on
first use and replays it afterwards. Recordings stay committed in place. Clearing is an
explicit `cache clear` command that scopes by test file or single test, plus `--all`.
Snapshots keep their existing modes, and the same command clears them.**

1. **Storage: committed in place.** Cassettes stay in `<test dir>/__cassettes__/`, the
   ADR 0035 sidecar sits beside them, and snapshots stay in `__snapshots__/`. No cache
   directory is introduced, and `.gitignore` does not change. A reset is a deletion that
   shows up in the git diff, and CI replays from the repository without network access.

2. **`auto` mode.** `VcrMode` gains `"auto"`, and `auto` becomes the default. The mode is
   decided per test at setup:
   - Cassette file present: behave as `replay`. The request matcher is unchanged, and a
     request with no entry throws `CASSETTE_MISMATCH` (rule 4).
   - Cassette file absent: behave as `record`. The cassette and sidecar are written at
     teardown.
   - `CI` set and cassette absent: fail with `CASSETTE_NOT_FOUND` and record nothing. This
     matches snapshot `ci` mode, so a CI run cannot create recordings.
   Explicit `VCR_MODE=record|replay|passthrough` keeps its current meaning.

3. **Only a complete run writes the cache.** In `auto`, teardown writes the cassette and
   sidecar only when the test body resolved. A failed body writes nothing, so a broken
   first run cannot leave a partial recording that later runs would replay. The fixture
   detects this by wrapping `await use(helper)` in a `try`. Explicit `record` mode keeps
   its existing write-at-teardown behaviour.

4. **Cache miss is loud.** In `auto`, a request missing from a present cassette throws
   `CASSETTE_MISMATCH`. The message names the exact command to clear that test:
   `bunx test-utils cache clear --file <test file> --test "<test name>"`. Nothing is
   recorded silently and nothing is appended. Replay of a callback the sidecar lacks keeps
   `CALLBACK_NOT_RECORDED` (ADR 0035).

5. **Clear command.** `bunx test-utils cache clear` takes exactly one scope:
   - `--file <path>` — the suite. Clears every cassette, sidecar, and snapshot belonging to
     that test file.
   - `--file <path> --test "<name>"` — one test case. Uses the same slug rule as the
     runtime (`slugifyFilename`) to find `__cassettes__/<slug>.json`,
     `__cassettes__/<slug>.callbacks.json`, and `__snapshots__/<slug>.snap.json`.
   - `--all` — every `__cassettes__/` and `__snapshots__/` directory under the working
     directory, skipping `node_modules`.
   `--dry-run` prints the files and deletes nothing. With no scope the command exits with
   a usage error. It deletes only files whose names match these patterns, and never a
   directory. Deleting committed recordings is reversible through git, and the command
   says so in its output.

6. **Snapshots.** No new snapshot mode. `match` already records missing snapshots, and `ci`
   already refuses. The new behaviour is the clear command. After a clear, the next run
   records new baselines, so the git diff of the snapshot files is the review that catches
   a regression accepted by mistake.

7. **Public surface.** Each change is additive or a documented default change:
   - the `auto` value of `VCR_MODE` and the new default (behaviour change, noted in the
     docs and the changelog);
   - the `test-utils cache clear` subcommand and its flags;
   - spec 0012 amended for `auto` (R3, and the storage rule in R2), and spec 0013 amended
     for snapshot clearing;
   - the README and `apps/docs` guides updated in the same change.
   A changeset is not added before M5 (`.changeset/README.md`), per the workflow.

8. **Ordering.** ADR 0035 (the sidecar) is implemented first. `auto` treats the sidecar as
   part of the cache, so the sidecar must exist before the mode can be correct.

## Consequences

**Good**

- The first run records, and every later run replays with no network access. This is the
  behaviour asked for, and it is the default.
- A reset has one command with a dry run. The scope is a file or a test name, which is
  what a user can name.
- A stale cache fails with the exact clear command, not with a silent re-record or an
  appended episode.
- A failed first run cannot poison the cache.
- CI cannot record, so an unexpected network call in CI shows up as a failure.

**Bad**

- Changing the default changes behaviour for any user who relied on `record` overwriting
  every run. The change is documented, but it is still a change.
- Committed recordings contain real response bodies. Redaction covers sensitive request
  headers only, so a recording can contain data the test received. The guide must warn of
  this before a user commits a recording, and the existing redaction behaviour is unchanged.
- Test names are the cache key, so renaming a test orphans its cassette. The clear command
  can remove orphans only with `--all`, not by detecting them.
- The `CI` check depends on the environment variable being set in CI. A CI system that does
  not set it gets the local behaviour.

## Alternatives considered

- **Gitignored cache directory.** Rejected by the maintainer. CI would have no recordings,
  and it contradicts the snapshot docs.
- **Keep `record` as the default and add `auto` as an opt-in.** Rejected by the maintainer.
  It would keep the default that re-hits the network on every run.
- **`VCR_RESET` environment variable keyed by describe block.** Rejected by the maintainer.
  The fixture context has no describe-block path, so this needs new plumbing and a new
  scope concept.
- **Append missing requests (`new_episodes`).** Rejected by the maintainer. The cache would
  change silently, and CI could reach the network.
- **Record on every run but replay when a cassette exists, in CI as well.** Rejected: it
  would let CI create recordings, which is the failure this design blocks.
- **Snapshot-only auto mode without the cassette change.** Rejected: snapshots already
  behave this way, and the request covers cassettes too.

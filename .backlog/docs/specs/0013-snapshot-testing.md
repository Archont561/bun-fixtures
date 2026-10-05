# 0013 — Snapshot Testing Fixture

- **Status:** implemented
- **Implementation:** `packages/snapshot/` or `@bun-fixture/snapshot`
- **Tests:** `packages/snapshot/tests/`

## Problem

`bun:test` ships `expect().toMatchSnapshot()`, but it only compares a single
serialized value per `expect()` call against Bun's own `__snapshots__/*.snap`
format, with no hook for custom serialization (DOM nodes, binary buffers,
HTTP responses recorded by `@bun-fixture/vcr`) and no CI-specific mode that
fails loudly instead of silently recording a forgotten snapshot. Tests also
often want to snapshot the *contents of a file* a fixture produced (e.g. a
report written into a `@bun-fixture/std` `tmpdir`), which has no direct
built-in equivalent.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `snapshot` fixture MUST serialize an arbitrary value and compare it against a stored snapshot, via `match(value, name?)`. |
| R2 | `snapshot` fixture MUST support snapshotting file contents directly via `matchFile(path, name?)`. |
| R3 | A missing snapshot MUST be recorded automatically in `"match"` mode (default outside CI) and MUST fail in `"ci"` mode. |
| R4 | Snapshot files MUST live at `__snapshots__/<test name>.snap.json` next to the test file, with no explicit bookkeeping required; the resolved path MUST be exposed as `snapshot.path`. |
| R5 | Multiple snapshots within one test MUST be addressable: auto-numbered (`value`, `value 2`, ...) when unnamed, or by an explicit `name`. |
| R6 | Mode MUST be switchable via the `SNAPSHOT_MODE` environment variable (`match` \| `update` \| `ci`) or `setMode()`, and MUST default to `"ci"` when `process.env.CI` is set and `SNAPSHOT_MODE` is unset. |
| R7 | Custom serializers MUST be pluggable via `addSerializer()`, running before the built-in string / `Error` / sorted-key-JSON / `String()` fallbacks. |
| R8 | A mismatch in `"match"`/`"ci"` mode MUST throw an error that includes both the stored and received values. |

## Verification

- Tests verifying first-run recording, then a passing replay against the stored snapshot.
- Tests verifying a mismatch throws a descriptive error, and that `"update"` mode overwrites instead.
- Tests verifying `"ci"` mode refuses to create a missing snapshot.
- Tests verifying auto-numbered keys for multiple anonymous `match()` calls in one test.
- Tests verifying a registered custom serializer is used ahead of the built-ins.
- Tests verifying `matchFile()` against a file on disk, including the not-found error path.

# 0002 — Preload discovery and directory merge

- **Status:** implemented
- **Milestone:** M2
- **Implementation:** `packages/bun-fixture/src/plugin.ts` (`discoverFixtures`, `fixturesFor`)
- **Tests:** `packages/bun-fixture/tests/nested/nested.test.ts`, `tests/fixtures.test.ts` ("merges every fixtures.ts…")

## Problem

pytest loads a `conftest.py` per directory. Bun's test scanner is closed
([oven-sh/bun#19196](https://github.com/oven-sh/bun/issues/19196)), so
per-directory preloading is impossible; the hierarchy must be emulated.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | At startup the preload MUST walk the project tree and import every `fixtures.ts` / `conftest.ts` (`.tsx` too) |
| R2 | The walk MUST skip `node_modules`, dot-directories, and build/cache output (`dist`, `build`, `out`, `coverage`, …) |
| R3 | A test file MUST see the merge of every fixture file from the discovery root down to its own directory |
| R4 | Deeper directories MUST win (last-wins merge, root → leaf) |
| R5 | Fixtures from sibling directories MUST NOT be visible |
| R6 | A fixture file that fails to import or lacks a default export MUST warn, not abort the run |
| R7 | The discovery root MUST default to `process.cwd()` and be overridable with `BUN_FIXTURE_ROOT`; `BUN_FIXTURE_NO_AUTODISCOVER` MUST skip the automatic walk |
| R8 | Discovery MUST be idempotent — loading the module as preload *and* as an import MUST NOT double-register |

## Design

`collectFixtureFiles` recurses with a depth cap of 24, returning paths sorted
shallow → deep. Each is dynamically imported; its default export is stored
against `dirname(file)` in `dirMap`.

`fixturesFor(testFile)` builds the ancestor chain from the root to the test
file's directory, `Object.assign`s the maps in that order, and memoises the
result. A test file outside the discovery root falls back to its own directory
only.

State lives on the global singleton, so the second load of the module is a
no-op.

## Out of scope

Watch mode / re-discovery; fixtures declared inline in a test file;
per-directory preloading (blocked upstream).

## Verification

| Requirement | Test |
|-------------|------|
| R3, R4 | "the nearest fixtures.ts wins", "inherits fixtures from ancestor directories" |
| R5 | "but not from a sibling directory" |
| R3 | "merges every fixtures.ts from the root down to this directory" |
| R1, R4 | "a fresh project: init → preload → run → teardown" (root + `sub/` fixture files) |

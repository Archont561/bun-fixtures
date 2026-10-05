# M2 — Preload discovery and merge

- **Status:** ✅ done
- **Estimate:** 0.5 d
- **Specs:** [0002](../specs/0002-discovery-and-merge.md)
- **Backlog task:** `task_002`

## Goal

Dropping a `fixtures.ts` into any directory makes those fixtures available to
tests in that directory and below, with no imports and no registration.

## Scope

- [x] Startup tree walk from the discovery root, skipping `node_modules`, dot-dirs, build output
- [x] `fixtures.ts` / `conftest.ts` (+ `.tsx`) recognised
- [x] Root → leaf last-wins merge, memoised per test file
- [x] Idempotent across preload + direct import (global singleton state)
- [x] `BUN_FIXTURE_ROOT`, `BUN_FIXTURE_NO_AUTODISCOVER`
- [x] Broken fixture files warn instead of aborting the run

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Nearest directory wins | "the nearest fixtures.ts wins" |
| 2 | Ancestors are inherited | "inherits fixtures from ancestor directories" |
| 3 | Siblings are invisible | "but not from a sibling directory" |
| 4 | Works in a non-dogfooded project | "a fresh project: init → preload → run → teardown" |

## Out of scope

Per-directory preloading — blocked by [oven-sh/bun#19196](https://github.com/oven-sh/bun/issues/19196).

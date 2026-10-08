# M8 — UI regression and browser diagnostics

**Task:** `task_054`  
**Target:** v0.4.0

## Dependencies

M1 browser fixtures, M5 publication, and stable snapshot semantics.

## Scope

- Deterministic accessibility snapshots.
- Separate visual screenshot snapshots with update and CI modes.
- Playwright screenshots, traces, console logs, and failed-request artifacts.

## Exit criteria

- Accessibility output is stable across supported environments.
- Visual diffs are reviewable and stored locally.
- Browser failures link to actionable artifacts in the local report.

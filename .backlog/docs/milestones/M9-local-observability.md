# M9 — Local test observability report

**Task:** `task_055`  
**Target:** v1.1.0

## Dependencies

M6 coverage artifacts and M8 browser artifacts.

## Scope

- Versioned local test-run manifest and event stream.
- Offline browser report for tests, fixtures, coverage, snapshots, network history, and artifacts.
- Local run history without a hosted service or mandatory database.

## Exit criteria

- `bunx test-utils report` opens a local report from generated artifacts.
- Failed tests expose fixture timelines, diffs, and related artifacts.
- Artifact and manifest schemas are versioned.

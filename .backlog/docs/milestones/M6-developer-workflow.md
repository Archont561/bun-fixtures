# M6 — Developer workflow and monorepo coverage

**Task:** `task_052`  
**Target:** v0.2.0

## Scope

- Interactive Clack scaffold for unit, API, browser, property, BDD, and multi-test suites.
- Workspace-aware test location and existing fixture-composition detection.
- Thin monorepo coverage command delegating execution to Bun and Turbo.

## Exit criteria

- Scaffold previews files, supports `--dry-run`, and never overwrites without consent.
- A suite can contain multiple generated tests without duplicated imports or setup.
- Coverage produces a root LCOV report and preserves Bun exit codes.

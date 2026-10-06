# M3 — CLI `init`

- **Status:** ✅ done
- **Estimate:** 0.5 d
- **Specs:** [0003](../specs/0003-cli-init.md)
- **Backlog task:** `task_003`

## Goal

`bunx test-utils init` leaves a project ready to compose fixtures explicitly.

## Scope

- [x] `bunfig.toml` created or updated, `[test].preload` appended
- [x] Idempotent; string `preload` normalized to a list; other sections preserved
- [x] No fixture-file scaffold; users create a `test.extend()` module explicitly
- [x] `--dir`, `--entry`, `--help`, `--version`; `--force` retained for compatibility
- [x] Warn about comment loss in the TOML round-trip

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | TOML mutation is pure and tested | `cli` suite |
| 2 | Initialized project runs with explicit composition | "`init` initializes a project end to end" |

## Notes

The published preload entry is `./node_modules/bun-test-utils/dist/plugin.js`;
Bun rejects the bare `node_modules/...` form with `preload not found`.

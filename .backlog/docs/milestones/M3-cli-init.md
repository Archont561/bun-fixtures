# M3 — CLI `init`

- **Status:** ✅ done
- **Estimate:** 0.5 d
- **Specs:** [0003](../specs/0003-cli-init.md)
- **Backlog task:** `task_003`

## Goal

`bunx bun-fixture init` leaves a project ready to write its first fixture test.

## Scope

- [x] `bunfig.toml` created or updated, `[test].preload` appended
- [x] Idempotent; string `preload` normalized to a list; other sections preserved
- [x] Root `fixtures.ts` scaffold, `--force` to overwrite
- [x] `--dir`, `--entry`, `--help`, `--version`
- [x] Warn about comment loss in the TOML round-trip

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | TOML mutation is pure and tested | `cli` suite |
| 2 | Scaffolded project actually runs | "`init` scaffolds a project end to end" |

## Notes

The preload entry is `./node_modules/bun-fixture/src/plugin.ts`; Bun rejects the
bare `node_modules/...` form with `preload not found`.

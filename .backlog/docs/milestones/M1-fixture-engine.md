# M1 — Fixture engine

- **Status:** ✅ done
- **Estimate:** 1 d
- **Specs:** [0001](../specs/0001-fixture-engine.md)
- **Backlog task:** `task_001`

## Goal

Scoped, injectable, parameterized fixtures resolve and tear down correctly
around a plain `bun:test` case.

## Scope

- [x] `session` / `file` / `test` scopes with per-scope caches
- [x] `await use(value)` suspension — teardown is the code after it
- [x] LIFO teardown per scope
- [x] Dependency resolution by name (destructuring + explicit `deps`)
- [x] Registration-time validation: unknown fixture, cycle, scope violation
- [x] Parameterized fixtures expanded as a cartesian product
- [x] `createTest(file)` and stack-trace-detecting top-level `test`

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Scopes behave as specified | `scopes` suite |
| 2 | Teardown is LIFO | "teardown is LIFO" |
| 3 | Bad fixture graphs fail at registration | `engine internals` suite |
| 4 | Params produce one `bun test` case per combination | `parameterization` suite |

## Notes

Two deviations from the original spec, both documented in
[ADR 0006](../adr/0006-use-returns-a-promise.md) and
[ADR 0007](../adr/0007-file-scope-closes-on-file-switch.md): `use` returns a
promise, and file scope closes when the next file starts.

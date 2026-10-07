# 0001 — Fixture engine

- **Status:** implemented
- **Milestone:** M1
- **Implementation:** `packages/bun-fixture/src/plugin.ts`
- **Tests:** `packages/core/tests/plugin.test.ts` (`injection`, `scopes`, `engine internals`, `parameterization removal`)
- **Amended:** parameterization (R8–R10) was removed before 0.1.0 by
  [ADR 0020](../adr/0020-remove-parameterized-fixtures.md); varying a test over
  values is `test.prop` (spec 0010).

## Problem

`bun test` has no fixture API ([oven-sh/bun#8257](https://github.com/oven-sh/bun/issues/8257)).
Scoped setup/teardown and dependency injection must be provided on top of plain
`test()`.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | A fixture MUST be definable as `{ setup, scope?, deps? }` |
| R2 | `setup(use, ctx)` MUST publish its value through `use(value)`; `await use(value)` MUST suspend until the scope ends so the remainder is teardown |
| R3 | Scopes MUST be `session` (once per run), `file` (once per test file), `test` (default, per test) |
| R4 | Teardown MUST run LIFO — dependents before their dependencies |
| R5 | Dependencies MUST resolve by name, auto-detected from the destructured second parameter of `setup`, overridable with `deps` |
| R6 | A fixture MUST NOT depend on a shorter-lived fixture; violations MUST throw at registration |
| R7 | Unknown fixtures and dependency cycles MUST throw at registration, listing the available names |
| R11 | A fixture that returns without calling `use` MUST fail with a clear error |
| R12 | Session fixtures MUST be torn down once after the whole run; file fixtures when their file is finished |

## Design

Per-scope caches live on a global singleton (`globalThis.__BUN_FIXTURE__`) so
that loading the module twice — once as preload, once as an import — shares
state. Each instance stores `{ value, teardown }`; teardown resolves the promise
returned by `use` and awaits the rest of the setup function.

Instances are keyed by `name + definition identity`, so two directories
declaring a same-named fixture never collide in the session cache.

Registration is eager: `resolveOrder` topologically sorts and validates the
requested fixtures before a single `bun:test` case is registered, so mistakes
surface as registration errors rather than runtime surprises. A case is
registered under exactly the name it was given.

## Out of scope

`autouse` fixtures; a `request` object (`request.node` has no equivalent);
fixture overriding by a test itself; parameterized fixtures (removed by
[ADR 0020](../adr/0020-remove-parameterized-fixtures.md) — see spec 0010 for
`test.prop`).

## Verification

| Requirement | Test |
|-------------|------|
| R1, R2, R5 | "resolves dependencies by name", "supports an explicit fixture list" |
| R3 | "file-scoped fixtures are created once per file", "...and shared with the next test in the same file", "test-scoped fixtures are rebuilt every test", "session fixtures are shared across files" |
| R4 | "teardown is LIFO" |
| R6, R7 | "throws on a scope violation", "throws on an unknown fixture", "throws on a dependency cycle" |
| R12 | "a fresh project: init → preload → run → teardown" (asserts `up` precedes `down`) |
| *removed* | parameterization removal: "ignores params and injects no ctx.param", "...which means it ran exactly once, with no param" (ADR 0020) |

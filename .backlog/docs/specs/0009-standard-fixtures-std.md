# 0009 — Standard Built-in Fixtures (@bun-fixture/std)

- **Status:** implemented
- **Implementation:** `packages/std/`
- **Tests:** `packages/std/tests/std.test.ts` (unit) and `packages/bun-fixture/tests/std.test.ts` (dogfooded through the engine via `packages/bun-fixture/tests/fixtures.ts`)

## Problem

Almost every backend, CLI, and integration test suite needs temporary directories, environment variable sandboxing, or stdout/stderr capture. Developers currently write boilerplate teardown logic in `afterEach` hooks that leak state when tests crash.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `tmpdir` fixture MUST generate a unique temporary directory under OS tmpdir or project scratch dir. |
| R2 | `tmpdir` MUST provide convenience methods: `write(filename, content)`, `read(filename)`, `exists(filename)`, `path(filename)`. |
| R3 | `tmpdir` MUST recursively delete the temporary directory during LIFO teardown. |
| R4 | `env` fixture MUST provide `set(key, val)`, `delete(key)`, and snapshot current `process.env`. |
| R5 | `env` MUST restore `process.env` to its exact original state upon test completion. |
| R6 | `stdio` fixture MUST intercept `process.stdout.write` and `process.stderr.write` without leaking uncaptured console output. |
| R7 | `stdio` MUST provide `stdout()`, `stderr()`, `clear()`, and restore standard streams on teardown. |

## Verification

- Unit tests verifying clean state reset even after thrown assertions.
- Concurrency test ensuring parallel test executions receive isolated tempdirs and environments.

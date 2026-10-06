# 0009 — Standard Built-in Fixtures (@bun-fixture/std)

- **Status:** implemented
- **Implementation:** `packages/std/`
- **Tests:** `packages/std/tests/{tmpdir,env,stdio,clock,seed,network-guard}.test.ts` (focused unit tests) and `packages/bun-test-utils/tests/conformance/std.test.ts` (dogfooded through the assembled package)

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
| R8 | `clock` MUST wrap `bun:test` `setSystemTime`, provide `freeze`, `set`, and `now`, and restore real system time on teardown. |
| R9 | `seed` MUST replace `Math.random` with a deterministic per-test generator, accept an explicit replay seed, report that seed when a test fails, and restore the original function on teardown. |
| R10 | `networkGuard` MUST reject unexpected `fetch` calls with the stable message `[bun-test-utils] networkGuard blocked unexpected fetch: <METHOD> <URL>. Allow it explicitly with networkGuard.allow(...).` |
| R11 | `networkGuard` MUST accept explicit string, regular-expression, and predicate passthrough allowlist entries and restore `fetch` on teardown. |
| R12 | Fetch interception MUST share the interceptor and matcher machinery used by `httpMock`, rather than maintaining a second implementation. |

## Verification

- Unit tests verifying clean state reset even after thrown assertions.
- Concurrency test ensuring parallel test executions receive isolated tempdirs and environments.

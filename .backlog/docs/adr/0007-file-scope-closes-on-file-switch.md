# 0007 — File scope closes when the next file starts

- **Status:** accepted

## Context

File-scoped fixtures need an "end of this test file" hook. The obvious choice,
`afterAll`, is registered lazily on the first `test()` call — and if that call
happens inside a `describe`, the hook is scoped to that block and fires early,
tearing fixtures down while later blocks still need them. This was observed in
the dogfooding suite.

## Decision

Do not register a per-file `afterAll`. Bun runs test files sequentially, so the
engine tracks the current file and tears down the previous file's fixtures when
the next file runs its first test. A global `afterAll`, registered once at
preload time, closes the last file and all session fixtures.

## Consequences

**Good** — correct regardless of where the first `test()` call sits; also closes
session scope reliably, which `process.on("beforeExit")` does not (it never
fires under `bun test`).

**Bad** — a file's fixtures stay alive slightly past the end of their file
(until the next file starts, or the end of the run). Resource-heavy fixtures
feel this; documented in the README. Would break if Bun ever interleaves files
in one process.

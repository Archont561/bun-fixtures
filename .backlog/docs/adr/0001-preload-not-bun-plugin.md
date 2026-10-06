# 0001 — Preload script, not `Bun.plugin()`

- **Status:** accepted, with discovery rationale superseded

## Context

The engine needs a run-global hook so session- and file-scoped fixtures are torn
down after the whole Bun test run. Earlier versions also used the preload for
fixture discovery; that behavior has been removed.

## Decision

Ship the engine as an optional preload script registered in `bunfig.toml`
(`[test].preload`), not as a `Bun.plugin()`. The preload installs lifecycle
backstops only. It does not walk the project tree and does not load
`fixtures.ts` or `conftest.ts`.

Fixtures are composed explicitly through imported `test.extend()` chains.

## Consequences

**Good** — preload is the only documented "before tests" hook and provides a
single run-global teardown point. The same module doubles as the package entry,
so lifecycle state is shared.

**Bad** — setup still requires editing `bunfig.toml` for best session teardown
behavior, hence the `init` CLI. Users who only import `{ test }` still work, with
`beforeExit` as a teardown backstop.

## Alternatives considered

`Bun.plugin()` — only intercepts module resolution/loading, never runs "before
the suite". Rejected.

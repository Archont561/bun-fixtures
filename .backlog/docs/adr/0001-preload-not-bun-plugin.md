# 0001 — Preload script, not `Bun.plugin()`

- **Status:** accepted

## Context

Fixtures must be discovered *before* any test file is evaluated, because
`test()` validates its fixture graph at registration time.

## Decision

Ship the engine as a preload script registered in `bunfig.toml`
(`[test].preload`), not as a `Bun.plugin()`.

## Consequences

**Good** — preload is the only documented "before tests" hook; top-level
`await` works, so discovery can dynamically import fixture files. The same
module doubles as the package entry, so state is shared without a registry
module.

**Bad** — setup requires editing `bunfig.toml`, hence the `init` CLI. Users who
only `import { test } from "bun-fixture"` still work (the import triggers
discovery), but pay the tree walk on first import.

## Alternatives considered

`Bun.plugin()` — only intercepts module resolution/loading, never runs "before
the suite". Rejected.

# 0005 — Explicit import, no global monkey-patch

- **Status:** accepted

## Context

The preload *could* overwrite the global `test` so every file gets fixtures for
free.

## Decision

Keep `bun:test` untouched. Fixtures are opt-in per file via
`import { test } from "bun-fixture"`.

## Consequences

**Good** — files that do not import it behave exactly as before; no surprising
action at a distance; mixing plain `bun:test` and fixture tests in one project
is fine.

**Bad** — one import line per test file, and two ways to get a `test`
(`createTest(import.meta.path)` or the stack-trace-detecting top-level `test`).

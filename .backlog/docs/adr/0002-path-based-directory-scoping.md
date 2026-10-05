# 0002 — Path-based directory scoping

- **Status:** accepted

## Context

pytest loads one `conftest.py` per directory. Bun's test scanner is closed
([oven-sh/bun#19196](https://github.com/oven-sh/bun/issues/19196)), so a
preload cannot be registered per directory.

## Decision

Walk the tree once at startup, map `directory → fixtures`, and resolve a test
file's fixtures by merging every ancestor map from the root down (last wins).

## Consequences

**Good** — `conftest.py` ergonomics with a single preload; merge is pure and
memoised, so it is cheap and unit-testable.

**Bad** — discovery is static: every fixture file in the project is imported
even if no test uses it, so a fixture file with side effects at module scope
pays them always. Fixture files should therefore stay declarative, and must use
`import type` when referencing `bun-fixture` to avoid an import cycle during
discovery.

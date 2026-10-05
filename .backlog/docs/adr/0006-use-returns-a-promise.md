# 0006 — `use` returns a promise

- **Status:** accepted

## Context

The original spec typed `use` as `(value: T) => void`. With a `void` return,
`await use(v)` is meaningless and the code after it runs immediately — so
teardown-after-`use` (the pytest `yield` idiom the spec also shows) cannot work.

## Decision

Type it `(value: T) => Promise<void>`. The promise resolves when the fixture's
scope ends; everything after `await use(value)` is teardown.

## Consequences

**Good** — one idiom covers setup and teardown, and it reads like pytest's
`yield`. Not awaiting is still legal: the fixture simply has no teardown.

**Bad** — a signature deviation from the spec, and a fixture that forgets to
await has silently no cleanup. Documented in the README.

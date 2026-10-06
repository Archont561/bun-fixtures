# 0003 — Ship raw TypeScript

- **Status:** superseded by [0014](./0014-bunup-built-publication.md)

## Context

Bun executes TypeScript natively, and the package is Bun-only by definition
(`bun:test`).

## Decision

Publish `src/*.ts` directly: `main`, `module`, `exports`, and `bin` all point at
`.ts` files. No build step, no `dist/`.

## Consequences

**Good** — no build tooling, no sourcemaps, stack traces point at real source;
`bunx bun-fixture` runs the CLI straight from `src/cli.ts`.

**Bad** — unusable from Node or another runner; consumers typechecking with a
non-`bundler` module resolution may need settings adjustments.

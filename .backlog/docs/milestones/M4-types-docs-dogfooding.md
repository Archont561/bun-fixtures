# M4 — Types, docs, dogfooding

- **Status:** ✅ done
- **Estimate:** 0.5 d
- **Specs:** [0004](../specs/0004-public-api-and-types.md)
- **Backlog task:** `task_004`

## Goal

The package is typed strictly, documented, and tested with itself.

## Scope

- [x] `FixtureDef`, `Scope`, `FixtureContext`, `FixtureMap`, `TestOptions`, `UseFn`
- [x] `bunx tsc --noEmit` clean under `strict`
- [x] README: quickstart, scopes, teardown, DI, params, API, caveats
- [x] Dogfooding suite — the engine tested through its own fixtures
- [x] End-to-end test against a scratch project in `tmpdir`
- [x] Behavioural Gherkin suite — 5 features, 20 scenarios ([spec 0006](../specs/0006-behavioural-test-suite.md))
- [x] `@` alias to the package root for internal imports
- [x] `docs/` — specs, milestones, ADRs, workflow

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Suite green | `bun test` — 37 unit + 131 behavioural |
| 2 | Types clean | `bunx tsc --noEmit` |
| 3 | Every public behaviour has a spec | [specs index](../specs) |

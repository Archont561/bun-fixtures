# 0008 — No repository-root `fixtures.ts`

- **Status:** accepted

## Context

The dogfooding suite originally kept `events`, `config`, and a root `origin`
fixture in a `fixtures.ts` at the repository root, next to `src/`. It mixed
test-support code into the package root, sat in `tsconfig.include` as a
one-off, and risked being read as part of the shipped package.

## Decision

Remove it. All fixtures used by the suite live under `tests/` —
`tests/fixtures.ts` and `tests/nested/fixtures.ts`, which still give two levels
for the override test.

## Consequences

**Good** — the repository root holds only package files; `tsconfig.include` is
just `["src", "tests"]`; nothing suggests the root file ships.

**Bad** — the *root* level of the discovery walk is no longer exercised by the
in-repo suite. Coverage moved to the end-to-end test, which scaffolds a real
project in `tmpdir` with a root `fixtures.ts` plus a nested one and asserts the
merge. `bun-fixture init` still scaffolds a root `fixtures.ts` for consumers —
that is the right default for a project, just not for this repository.

# Caveats and non-goals

What `bun-test-utils` deliberately does not do, and where the implementation has known boundaries.

## Non-goals

| Area | Why |
|------|-----|
| Replacing `bun:test` | the library wraps `test`/`expect`; it does not ship a runner. |
| Parsing or running Gherkin `.feature` files | separate concern — see [`@aboviq/bun-test-cucumber`](https://www.npmjs.com/package/@aboviq/bun-test-cucumber), which this repo may use for its own behavioural suite. End users write BDD-style flows with `test.scenario(...)`. |
| Implicit fixture discovery | removed. `fixtures.ts` and `conftest.ts` are ordinary module names and are not automatically loaded. |
| Public capability subpaths | removed. Users import only `describe`, `test`, and `expect` from `bun-test-utils`; capabilities are built into the root `test` context or `test.*` methods. |

## Explicit composition only

Fixtures and mocks are available through the root `test` object and explicit `test.extend()` chains. The preload installs teardown hooks; it does not walk the project tree.

If a project keeps a module named `fixtures.ts`, tests must import it explicitly and pass its map to `test.extend()`.

# Caveats and non-goals

What `bun-test-utils` deliberately does not do, and where the implementation has
known boundaries.

## Non-goals

| Area | Why |
|------|-----|
| Replacing `bun:test` | the library wraps `test`/`expect`; it does not ship a runner. |
| Parsing or running Gherkin `.feature` files | separate concern — see [`@aboviq/bun-test-cucumber`](https://www.npmjs.com/package/@aboviq/bun-test-cucumber), which this repo uses for its own behavioural suite. The BDD bridge only makes explicit fixture maps reachable from step lifecycles. |
| Implicit fixture discovery | removed. `fixtures.ts` and `conftest.ts` are ordinary module names and are not automatically loaded. |

## Explicit composition only

Fixtures are available only through an imported `test.extend()` chain or a
documented integration API such as `openFixtures()` / `fixtureSteps()`. The
preload installs teardown hooks; it does not walk the project tree.

If a project keeps a module named `fixtures.ts`, tests must import it explicitly
and pass its map to `test.extend()`.

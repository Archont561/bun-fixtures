# Caveats and non-goals

What `bun-test-utils` deliberately does not do, and where the implementation has known boundaries.

Non-goals below are permanent. Work that is merely *deferred* — parked with a trigger that
would unpark it — lives in the [roadmap](../../README.md#roadmap--deliberately-deferred)
and in `task_042`. The difference matters: a non-goal is closed, a deferral is waiting.

## Non-goals

| Area | Why |
|------|-----|
| Replacing `bun:test` | the library wraps `test`/`expect`; it does not ship a runner. |
| Parsing or running Gherkin `.feature` files | separate concern — see [`@aboviq/bun-test-cucumber`](https://www.npmjs.com/package/@aboviq/bun-test-cucumber), which this repo may use for its own behavioural suite. End users write BDD-style flows with `test.scenario(...)`. |
| Implicit fixture discovery | removed. `fixtures.ts` and `conftest.ts` are ordinary module names and are not automatically loaded. |
| Public capability runner/fixture subpaths | Not exposed. The only public helper subpaths are `bun-test-utils/pbt` and `bun-test-utils/bdd`; they export typed definition wrappers, while capabilities are built into the root `test` context or `test.*` methods. |
| Stable VCR matcher DSL, configurable redaction, or cassette migration | deferred until post-release demand establishes the right API; `0.1.x` freezes only callback record/replay and exact method-plus-full-URL matching. |
| Windows support in `0.1.x` | deferred until POSIX `URL.pathname` assumptions are removed and a Windows CI lane exists. |

## Explicit composition only

Fixtures and mocks are available through the root `test` object and explicit `test.extend()` chains. The preload installs teardown hooks; it does not walk the project tree.

If a project keeps a module named `fixtures.ts`, tests must import it explicitly and pass its map to `test.extend()`.

## Experimental capabilities

Browser and BDD are experimental and may change in minor releases. Browser carries
the Playwright peer and the heaviest CI path; BDD depends on pre-1.0
`@aboviq/bun-test-cucumber`. The engine and standard, DOM, snapshot,
property-testing, and minimal VCR capabilities follow the stable semantic-versioning
contract in [ADR 0018](./adr/0018-release-compatibility-contract.md).

# 0012 — BDD fixture bridge: narrow the Gherkin non-goal

- **Status:** accepted
- **Date:** 2026-10-05
- **Update (2026-10-05, grill-me sessions):** approved for implementation
  ("real demand" — see spec 0014's changelog). Packaging was revisited twice
  the same day:
  1. First reversal: ships as `optional/bdd.ts` inside the renamed
     `bun-test-utils` core, not a standalone `@bun-test-utils/bdd` package.
  2. Final reversal: the "ecosystem of separately-published packages" model
     is gone entirely (see the ADR superseding ADR 0011, authored as part of
     task_018/task_020). There is now exactly one published npm package,
     `bun-test-utils`; `std`, `pbt` (renamed from `fast-check`), `dom`,
     `browser`, `vcr`, and `snapshot` all become internal, unpublished
     (`private: true`) workspace
     packages bundled into it as flat subpath exports
     (`bun-test-utils/std`, `bun-test-utils/vcr`, ...). BDD follows the exact
     same pattern: an internal `packages/bdd` workspace package, bundled in
     as the `bun-test-utils/bdd` subpath export — there is no longer a
     distinction between "existing packages stay separate" and "new ones use
     `optional/*`"; every capability, old and new, is now one of these
     internal packages folded into the single published artifact.
  Depends on task_018 (the rename) and task_020 (the fold into one package)
  landing first. The decision below (narrow, don't drop, the Gherkin
  non-goal) is unaffected by either packaging reversal.

## Context

`docs/caveats.md` lists Gherkin/BDD feature files as a non-goal: *"separate
concern — see `@aboviq/bun-test-cucumber`, which this repo uses for its own
behavioural suite."* In practice that line conflates two different claims:

1. `bun-fixture` should not parse `.feature` files or implement a Gherkin
   runner. **Sound** — that is a mature, maintained concern belonging to a
   Cucumber implementation, not a fixture engine.
2. Fixtures resolved by `bun-fixture` are reachable only through its own
   `test()` / `createTest()`. **Accidental**, not deliberate — nothing about
   the engine's design requires this, it is just the only entry point that
   exists today.

The repo's own behavioural suite exposes the gap: `@aboviq/bun-test-cucumber`
registers one `bun:test` test per Scenario and shares state across steps
through its own `withState<World>()`, never through `bun-fixture`. Looking at
`packages/bun-fixture/tests/steps/fixtures.steps.ts` confirms it — steps
import `expect` from `bun:test` directly and hand-roll a `World` interface
that duplicates exactly what fixtures already solve (shared, scoped,
torn-down-in-order state).

Every existing companion package (`std`, `fast-check`, `dom`, `browser`,
`vcr`, `snapshot`) is a thin adapter around an external tool, reached
exclusively through `test()`/`createTest()` — none of them register their own
`bun:test` test. A Cucumber adapter structurally can't follow that pattern:
`@aboviq/bun-test-cucumber`'s loader registers the `bun:test` test itself, one
per Scenario, so there is no `test()` call left for `bun-fixture` to wrap.
Giving BDD steps real fixture access therefore requires something that does
not exist yet: a way to build and tear down fixtures for a context **without**
also calling `bun:test`'s `test()`.

## Decision

1. Keep the core of the existing non-goal: `bun-fixture` will never parse
   `.feature` files or implement a Gherkin runner. That stays
   `@aboviq/bun-test-cucumber`'s job (or any other Cucumber implementation).
2. Narrow the claim that fixtures are only reachable through `test()`. Add one
   small, explicit, public engine export, `withFixtures(testFile, names, fn)`
   (see spec [0014](../specs/0014-bdd-fixture-bridge.md) for the exact
   signature), that resolves fixtures for an ad hoc `FixtureContext` and tears
   down test-scoped instances LIFO when `fn` settles. This generalizes the
   `buildAll`/`unwind` pair the engine already uses privately for
   `opts.iterate` — it is not a new mechanism, just a new door to the existing
   one.
3. Sanction a new internal workspace package, `packages/bdd`
   (`@bun-test-utils/bdd` internally, published to consumers only as the
   `bun-test-utils/bdd` subpath — see the ADR superseding ADR 0011 for why
   nothing in this ecosystem is published as its own npm package anymore),
   that calls `withFixtures` from `@aboviq/bun-test-cucumber`'s
   `Before`/`After` hooks so `Given`/`When`/`Then` steps can request named
   fixtures on `World` — the same scope/teardown/caching guarantees every
   other test gets.
4. Rephrase the Gherkin line in `docs/caveats.md` to point at this ADR instead
   of reading as an unconditional "separate concern."

## Consequences

**Good**

- BDD step authors get the same DI, scope caching, and LIFO teardown
  guarantees as every other test, instead of a hand-rolled `World`.
- `withFixtures` is a small, generically useful primitive, not BDD-specific —
  it is also the natural foundation for the previously discussed `useFixture()`
  DX helper (outside this ADR's scope, but the same door).
- No new parsing/runtime commitment: Cucumber itself remains someone else's
  problem, consistent with how `vcr` doesn't reimplement HTTP and `dom`
  doesn't reimplement `happy-dom`.

**Bad**

- Grows the core engine's public API surface for the first time since spec
  0004 — one more exported function to keep stable across versions.
- Two independent "share state across steps" idioms now coexist in a suite
  that uses this bridge: Cucumber's `World` and `bun-fixture`'s fixtures. Needs
  clear documentation about which to reach for (fixtures for anything that
  also has to work outside Cucumber; `World` for pure scenario bookkeeping).
- The `bdd` subpath depends on an external package's (`@aboviq/bun-test-cucumber`)
  hook API remaining stable; it is an `optionalDependencies` /
  `peerDependenciesMeta.optional` entry on `bun-test-utils`, same pattern as
  `playwright` gating the `browser` subpath.

## Alternatives considered

- **Do nothing (status quo).** Rejected — leaves a real, user-reachable gap
  (surfaced by auditing "what testing strategies are covered") while every
  other paradigm (DOM, browser, property-based, HTTP, snapshot) already has an
  adapter.
- **Ship a Gherkin parser/runner inside `bun-fixture` itself.** Rejected —
  duplicates mature, maintained tooling and contradicts the "thin core plus
  adapters" shape from ADR 0010 / ADR 0011.
- **Monkey-patch `@aboviq/bun-test-cucumber`'s `World` to inject fixtures
  automatically.** Rejected — fragile coupling to that package's private
  internals, and against the spirit of ADR 0005 (explicit import, no global
  monkey-patch).

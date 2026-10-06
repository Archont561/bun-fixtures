# 0014 — BDD Fixture Bridge (`withFixtures` + `bun-test-utils/bdd`)

- **Status:** implemented in the `bun-test-utils/bdd` subpath; scenario-chain API revision in progress under task_021
- **ADR:** [0012](../adr/0012-bdd-fixture-bridge.md)
- **Implementation:** `packages/core/src/plugin.ts` (`openFixtures`/`withFixtures`),
  `packages/bdd/` (internal workspace package,
  bundled into the published `bun-test-utils` package as the
  `bun-test-utils/bdd` subpath export)
- **Tests:** `packages/bun-test-utils/tests/conformance/subpaths.test.ts`,
  `packages/core/tests/plugin.test.ts`

## 2026-10-05 update (second revision, grill-me sessions)

Approved for implementation ("real demand" — the gap this spec closes was
worth building, not just documenting). Packaging was revisited twice:

1. First: proposed as `optional/bdd.ts` inside the renamed `bun-test-utils`
   core (superseded by the next point).
2. Final: the single-vs-ecosystem question was resolved project-wide
   (task_020) — there is now exactly **one** published npm package,
   `bun-test-utils`, and every capability (`std`, `vcr`, `dom`, `browser`,
   `pbt` (renamed from `fast-check`), `snapshot`, and now `bdd`) is an
   internal, unpublished
   (`private: true`) workspace package bundled into it as a flat subpath
   export. BDD therefore ships as `packages/bdd` — structurally close to
   this spec's *original* sketch below, just unpublished/bundled rather than
   independently published as `@bun-fixture/bdd` — exposed to consumers as
   `import { fixtureSteps } from "bun-test-utils/bdd"`.

The `withFixtures` core export (R1–R3) and the bridge mechanics (R4–R8) are
unaffected by either packaging reversal — only the publish/export mechanism
changed. Every `@bun-fixture/bdd` reference below means "the `bdd` subpath,
built from `packages/bdd`." Depends on task_018 (rename) and task_020 (the
fold) landing first.

## Problem

`@aboviq/bun-test-cucumber` step definitions have no access to `bun-fixture`'s
dependency injection. Shared state across `Given`/`When`/`Then` steps is
hand-rolled per suite via Cucumber's own `withState<World>()`
(`packages/bun-test-utils/tests/steps/fixtures.steps.ts` is the existing example),
duplicating scope caching and teardown ordering that every other test file
already gets for free by importing `bun-fixture`'s `test`.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | The core engine MUST export `withFixtures(testFile, names, fn)`, resolving session/file/test-scoped fixtures for an ad hoc context not created by `test()`, and tearing down the test-scoped instances it built (LIFO) once `fn` settles — mirroring the existing internal `opts.iterate` behaviour. |
| R2 | `withFixtures` MUST reuse the existing `resolveOrder` / scope-cache / dependency machinery, so a fixture requested this way behaves identically to one requested from `test()` (same errors for unknown fixtures, cycles, and scope violations). |
| R3 | Session- and file-scoped fixtures resolved via `withFixtures` MUST be the same cached instances a `test()` call in the same file/run would see — no duplicate construction. |
| R4 | `@bun-fixture/bdd` MUST expose a helper (`fixtureSteps(names)` or equivalent) that, given `@aboviq/bun-test-cucumber`'s `Before`/`After` hook API, builds the requested fixtures before a Scenario's steps run and tears them down after, attaching values to `World`. |
| R5 | Fixture names requested per Scenario MUST be declared explicitly (e.g. a `fixtureSteps([...])` call in the `.steps.ts` file) — destructured-parameter auto-detection does not apply, since step functions are not a single `test()` body. |
| R6 | A missing `@aboviq/bun-test-cucumber` (an optional/peer dependency) MUST throw an actionable install error, consistent with how `@bun-fixture/browser` handles a missing `playwright`. |
| R7 | `@bun-fixture/bdd` MUST be usable from a pure Cucumber step file — it MUST NOT require `bun-fixture`'s own `test()`/`createTest()` to also be called in that file. |
| R8 | A fixture-setup failure during `Before` MUST fail the Scenario with the original error surfaced, not a generic Cucumber hook error. |

## Design

Core engine addition (generalizes the private `buildAll`/`unwind` pair
`opts.iterate` already uses):

```ts
// bun-fixture
export async function withFixtures<T>(
  testFile: string,
  names: string[],
  fn: (ctx: FixtureContext) => T | Promise<T>,
): Promise<T>;
```

`@bun-fixture/bdd` built on top of it:

```ts
// @bun-fixture/bdd
import { withFixtures } from "bun-fixture";
import { After, Before } from "@aboviq/bun-test-cucumber";

export function fixtureSteps<World extends object>(
  testFile: string,
  names: string[],
): void {
  Before(async function (this: World) {
    await withFixtures(testFile, names, async (ctx) => {
      Object.assign(this, ctx);
      // Stash a resolver the paired `After` hook awaits to run teardown —
      // `withFixtures`'s `fn` only unwinds once its promise settles, so the
      // Before/After split holds it open across the Scenario's steps.
    });
  });
  After(async function (this: World) {
    // Resolve the held-open `withFixtures` call, running LIFO teardown.
  });
}
```

Usage in a `.steps.ts` file:

```ts
import { fixtureSteps } from "@bun-fixture/bdd";

interface World {
  db: Database;
  server: TestServerHelper;
}

fixtureSteps<World>(import.meta.path, ["db", "server"]);

Given("a seeded database", async function (this: World) {
  await this.db.seed(fixtures);
});
```

The `Before`/`After` split is the open implementation question (see below):
`withFixtures`'s `fn` callback naturally wants to wrap the whole Scenario, but
Cucumber's hook API offers two separate callbacks rather than one
wrap-the-scenario function. The bridge needs a way to keep `withFixtures`'s
internal promise "open" between `Before` and `After` — e.g. by having
`withFixtures` optionally return a `{ ctx, teardown }` pair instead of taking
a callback, for exactly this kind of external, two-phase caller.

## Out of scope

- Parsing or running `.feature` files — owned entirely by
  `@aboviq/bun-test-cucumber` (or any other Cucumber implementation); ADR 0012
  keeps this part of the non-goal.
- Auto-detecting fixture names from step function signatures (R5 makes
  explicit declaration a requirement instead).
- Combining `params` (parameterized fixtures) with Gherkin Scenario Outlines —
  left for a follow-up once the base bridge ships.
- Replacing Cucumber's `World` entirely — `World` remains for scenario-only
  bookkeeping that never needs to exist outside a `.feature` run.

## Verification

| Requirement | Test (proposed) |
|---|---|
| R1–R3 | `withFixtures` resolves the same cached session/file instance a sibling `test()` call in the same file would, and tears down test-scoped instances LIFO even when `fn` throws. |
| R4, R7 | A step file using only `@bun-fixture/bdd` (no `bun-fixture` `test()` import) gets fixtures on `World` and sees them torn down after the Scenario. |
| R5 | Omitting `fixtureSteps` leaves `World` without fixture properties — no implicit injection. |
| R6 | `@bun-fixture/bdd` imported without `@aboviq/bun-test-cucumber` installed throws a message naming the install command. |
| R8 | A fixture whose `setup` throws fails the Scenario with that error's message intact. |

## Open questions

- Exact shape of the core export: a callback-style `withFixtures(file, names, fn)`
  (consistent with `ctx.iterate`) vs. a `{ ctx, teardown }`-returning variant
  that two-phase callers like `Before`/`After` need without fighting the
  callback shape. The design sketch above suggests the latter may be
  unavoidable for this consumer.
- Whether fixture-teardown errors raised during a failed Scenario should
  surface as the `Then` step's failure or as a distinct `After`-hook failure
  in Cucumber's reporting.
- Whether `@bun-fixture/bdd` should eventually support per-Scenario fixture
  lists via Gherkin tags (e.g. `@fixtures(db,server)`) instead of a static
  `fixtureSteps([...])` call shared by every Scenario in a file.
- Interaction with session fixtures across `.feature` files run in the same
  process — should match the existing cross-file session caching semantics,
  but needs an explicit test once implemented.

## 2026-10-06 API revision — scenario chains

The public scenario API is deliberately separate from the low-level Cucumber hook
bridge. The supported user-facing shape is a typed fluent scenario chain:

```ts
test
  .scenario("checkout succeeds")
  .given("a customer exists", () => ({
    customer: createCustomer(),
  }))
  .given("the customer has an empty cart", () => ({
    cart: createCart(),
  }))
  .when("the customer checks out", async ({ api, customer, cart }) => ({
    order: await api.checkout(customer, cart),
  }))
  .then("the order is created", ({ order, expect }) => {
    expect(order).toBeDefined();
  });
```

Each `given` and `when` callback returns an object that is merged into the
context received by subsequent callbacks. `then` callbacks assert and do not
extend the context. Fixtures from `test.extend()` and generated property values
are direct context properties; there is no `get()` or `provide()` API.

The builder enforces the phase order in its types:

- `given()` may repeat only before the first `when()`;
- `when()` may repeat after `given()` and before `then()`;
- `then()` may repeat after `when()`;
- `given()` and `when()` are unavailable after their phase closes.

Property-based BDD uses the `test.scenario.prop()` namespace to avoid a naming
collision with direct `test.prop()` tests. Strategies are always explicit as
the second argument; they are never inferred from step strings:

```ts
test.scenario.prop("generated users can be persisted", {
  user: userStrategy,
  role: fc.constantFrom("admin", "member"),
})
  .given("a generated user", ({ user, role }) => ({
    input: { ...user, role },
  }))
  .when("the user is persisted", async ({ api, input }) => ({
    saved: await api.users.create(input),
  }))
  .then("the saved user matches the input", ({ saved, input, expect }) => {
    expect(saved.name).toBe(input.name);
    expect(saved.role).toBe(input.role);
  });
```

A property scenario executes the complete chain for every generated example and
shrink attempt. Test-scoped fixtures are rebuilt per example; session- and
file-scoped fixtures retain their normal sharing semantics. Gherkin step text is
stored for reporting and may use `<name>` placeholders for explicit property
references; `@name` remains reserved for Gherkin tags.

This API revision supersedes the earlier callback-context sketch below for new
scenario tests. The lower-level `fixtureSteps`/`openFixtures` bridge remains an
integration API for external Cucumber hooks.

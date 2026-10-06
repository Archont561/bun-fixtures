---
title: API Reference
description: Core TypeScript API reference for bun-test-utils.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose fixtures with `test.extend()` or import a capability subpath's pre-composed `test`.


## Exports

### `test(name, fn, options?)`

Defines a fixture-aware test. Only fixtures from the imported `test.extend()`
chain are available; `fixtures.ts` and `conftest.ts` files are not loaded
automatically. Requested fixtures are detected from the first parameter's
destructuring pattern:

```ts
test("my test", async ({ db }) => {
  // ...
});

// …or listed explicitly, along with other options:
test("my test", async (ctx) => { /* ... */ }, {
  fixtures: ["db"],
  timeout: 5000,
});
```

#### Test options

| Option | Type | Default | Behaviour |
| :-- | :-- | :-- | :-- |
| `fixtures` | `string[]` | auto-detected | Explicit fixture list, overriding auto-detection from the destructured parameter |
| `timeout` | `number` | Bun default | Per-test timeout in milliseconds, forwarded to `bun:test` |
| `iterate` | `boolean` | `false` | Defer test-scoped fixtures behind `ctx.iterate` (see below) |

### The iteration protocol: `iterate`

With `iterate: true`, the wrapper test never builds test-scoped fixtures
itself. Its context holds only session- and file-scoped values, plus an
`iterate` runner — designed for property-based tests and other companions
that re-execute a body many times inside one `bun test` case:

```ts
const samples = await fetchSamples();

test("roundtrip across samples", async (ctx) => {
  for (const sample of samples) {
    await ctx.iterate!(async ({ scratchDb }) => {
      // fresh scratchDb for this sample…
      await scratchDb.save(sample);
      expect(await scratchDb.load(sample.id)).toEqual(sample);
    });
    // …torn down here, strictly LIFO — even when the body threw
  }
}, { fixtures: ["scratchDb"], iterate: true });
```

Guarantees:

- Every `ctx.iterate(fn)` call builds the requested test-scoped fixtures
  **fresh**, and unwinds them **strictly LIFO** — including when `fn` throws.
- Session- and file-scoped instances are shared between the wrapper and
  every iteration, through the normal scope caches.
- `ctx.iterate` returns the result of the function it ran.
- [`bun-test-utils/pbt`](/bun-test-utils/guides/property-based-testing/)
  builds `test.prop` on this protocol: every generated sample — and every
  shrink candidate — runs through `ctx.iterate`, so no state can leak
  between iterations.

### `createFixture(definition)`

Creates a typed fixture declaration for a reusable fixture pack. It is an identity helper at runtime; the engine still owns dependency ordering, scopes, and teardown.

```ts
import { createFixture } from "bun-test-utils";

const clock = createFixture({
  scope: "test",
  setup: async (use) => {
    await use({ now: () => new Date(0) });
  },
});
```

### `test.scenario(title)`

Builds one fixture-aware test from fluent `given`, `when`, and `then` steps. Object results from `given` and `when` are merged into the next context; multiple steps in every phase are supported. `test.scenario.prop` adds generated fast-check values; see the [scenario guide](/bun-test-utils/guides/scenarios-and-fluent-api/).

### `createTest(testFile?)`

Creates a test runner bound to an explicit file path (useful when stack
trace inspection is not desired):

```ts
const { test, describe, expect } = createTest(import.meta.path);
const dbTest = test.extend({ db: dbFixture });
```

### `expect` and `describe`

Re-exported directly from `bun:test` for convenience.

## Types

The full public type surface:

| Type | Purpose |
| :-- | :-- |
| `Scope` | `"session" \| "file" \| "test"` — fixture lifetimes |
| `FixtureDef<T>` | The type of one fixture definition: `setup`, optional `scope`, `params`, `deps` |
| `FixtureMap` | The shape of a fixture map passed to `test.extend()` |
| `ThenChain<S>` | Fluent scenario chain for multiple `then` assertions |
| `FixtureContext` | Resolved fixture values plus metadata (`testFile`, `testName`, `param`, `scope`, `iterate`) |
| `TestOptions` | `{ fixtures?, timeout?, iterate? }` |
| `UseFn<T>` | The `use(value)` publisher handed to `setup` |
| `IterateFn` | The `ctx.iterate` runner signature |

```ts
import type { FixtureDef } from "bun-test-utils";

const db: FixtureDef<Db> = {
  scope: "file", // "session" | "file" | "test" (default)
  params: ["fast", "slow"], // optional: expand one case per value
  deps: ["events"], // optional: explicit deps (auto-detected otherwise)
  setup: async (use, ctx) => {
    const handle = await connect();
    await use(handle); // everything after the await is teardown
    await handle.close();
  },
};
```

## Environment variables

| Variable | Behaviour |
| :-- | :-- |
| `BUN_TEST_UTILS_DEBUG` | Emits opt-in diagnostics to stderr when set to `1` |

There are no fixture discovery environment variables. The preload does not walk
your project tree, and `fixtures.ts` / `conftest.ts` are not special filenames.

## Engine & tooling exports

Exported for tooling, companion runners, and tests of reusable fixture maps:

| Export | Purpose |
| :-- | :-- |
| `resolveOrder(requested, map, where)` | Topological order over requested fixtures — throws on cycles, unknown names, scope violations |
| `paramCombos(order, map)` | Cartesian product of every parameterized fixture |
| `destructuredKeys(fn, index)` | Identifiers of a destructured parameter |
| `detectFixtures(fn, index)` | Requested fixtures from a destructured parameter, metadata excluded |
| `callerFile(extraSelf?)` | Nearest caller file outside the engine (and `extraSelf`) from the stack trace |
| `openFixtures(map, names, context?)` / `withFixtures(...)` | Explicitly open a fixture map for integrations that manage their own lifecycle |
| `teardownFile(file)` / `teardownSession()` | LIFO teardown of file / session scopes |
| `configureDiagnostics(sink?)` / `reportDiagnostic(event)` | Opt-in structured diagnostics for integrations |

`detectFixtures` and `callerFile` exist for companion runners whose own
callbacks wrap the fixture context. `bun-test-utils/pbt` uses both:
`detectFixtures` sees through the `(fixtures, values)` signature of
`test.prop`, and `callerFile(ownIndexPath)` binds the calling test file
through the wrapper's own stack frames — mirroring how the top-level `test`
finds its file.

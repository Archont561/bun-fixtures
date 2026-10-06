---
title: API Reference
description: Core TypeScript API reference for bun-test-utils.
---

## Exports

### `test(name, fn, options?)`

Defines a fixture-aware test. Requested fixtures are auto-detected from the
first parameter's destructuring pattern:

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

### `createTest(testFile?)`

Creates a test runner bound to an explicit file path (useful when stack
trace inspection is not desired):

```ts
const { test, describe, expect } = createTest(import.meta.path);
```

### `expect` and `describe`

Re-exported directly from `bun:test` for convenience.

## Types

The full public type surface:

| Type | Purpose |
| :-- | :-- |
| `Scope` | `"session" \| "file" \| "test"` — fixture lifetimes |
| `FixtureDef<T>` | One fixture definition: `setup`, optional `scope`, `params`, `deps` |
| `FixtureMap` | The shape of a fixture map passed to `test.extend()` |
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
| `BUN_TEST_UTILS_ROOT` | Overrides the tree root used by discovery (defaults to `process.cwd()`) |
| `BUN_TEST_UTILS_NO_AUTODISCOVER` | Skips the startup tree walk entirely when set |

## Engine & tooling exports

Exported for tooling, companion runners, and testing fixture trees
themselves:

| Export | Purpose |
| :-- | :-- |
| `registerFixtures(dir, map)` | Register a fixture map programmatically |
| `fixturesFor(testFile)` | Internal fixture lookup helper; prefer explicit `test.extend()` composition |
| `resolveOrder(requested, map, where)` | Topological order over requested fixtures — throws on cycles, unknown names, scope violations |
| `paramCombos(order, map)` | Cartesian product of every parameterized fixture |
| `destructuredKeys(fn, index)` | Identifiers of a destructured parameter |
| `detectFixtures(fn, index)` | Requested fixtures from a destructured parameter, metadata excluded |
| `callerFile(extraSelf?)` | Nearest caller file outside the engine (and `extraSelf`) from the stack trace |
| `teardownFile(file)` / `teardownSession()` | LIFO teardown of file / session scopes |

`detectFixtures` and `callerFile` exist for companion runners whose own
callbacks wrap the fixture context. `bun-test-utils/pbt` uses both:
`detectFixtures` sees through the `(fixtures, values)` signature of
`test.prop`, and `callerFile(ownIndexPath)` binds the calling test file
through the wrapper's own stack frames — mirroring how the top-level `test`
finds its file.

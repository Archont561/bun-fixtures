---
title: Property-Based Testing
description: Generative tests with fast-check arbitraries over injected fixtures, with a per-sample fixture lifecycle.
---

`bun-test-utils/pbt` combines `fast-check` arbitraries with fixture
injection: instead of hand-written examples, you state a property and the
runner generates hundreds of samples — and shrinks any failure down to a
minimal counterexample.

## Installation

`pbt` ships inside `bun-test-utils` — `fast-check` is its one `optionalDependency`,
installed automatically unless your platform or install flags skip optional deps:

```bash
bun add -d bun-test-utils
# only if `bun install` skipped the optional dep:
bun add -d fast-check
```

## Writing a property test

```ts
import { test, expect, fc } from "bun-test-utils/pbt";

test.prop(
  "encoding is reversible",
  { text: fc.string(), key: fc.integer({ min: 1, max: 255 }) },
  async ({ codec }, { text, key }) => {
    expect(codec.decode(codec.encode(text, key), key)).toBe(text);
  },
  { numRuns: 100 },
);
```

- **Fixtures** are requested exactly like in plain tests: destructure the
  first parameter (auto-detected), or list names in `options.fixtures`.
- **Generated values** arrive as the second parameter, one key per
  arbitrary.
- **Every other `fast-check` parameter** (`numRuns`, `seed`, …) passes
  straight through to `fc.assert`.

## The fixture lifecycle per sample

A property test is one `bun test` case whose body re-executes hundreds of
times — so scope semantics matter more than usual:

| Scope | Across samples and shrinks |
| :-- | :-- |
| `session` / `file` | **Shared** — built once, reused for every sample |
| `test` (default) | **Rebuilt per sample** — fresh instance, torn down LIFO before the next one |

Under the hood this is the engine's
[`opts.iterate` protocol](/bun-fixtures/reference/api/#the-iteration-protocol-iterate):
every sample — and every candidate `fast-check` tries while shrinking a
failure — runs through `ctx.iterate`, which builds the test-scoped fixtures
fresh and unwinds them **even when the predicate throws**. A database
connection or temporary directory opened for one sample can never leak into
the next.

```ts
import { test, expect, fc } from "bun-test-utils/pbt";

test.prop(
  "orders survive a round-trip through the store",
  { orders: fc.array(fc.record({ id: fc.uuid(), total: fc.nat() })) },
  async ({ store }, { orders }) => {
    // `store` is test-scoped: rebuilt for this sample, wiped afterwards.
    await store.saveAll(orders);
    expect(await store.count()).toBe(orders.length);
  },
  { numRuns: 50 },
);
```

## Shrinking and failure output

When a sample fails, `fast-check` shrinks the input to the minimal failing
case and reports that counterexample. Parameterized fixture values still
appear in the test name, as they do for plain tests.

## When to list fixtures explicitly

Auto-detection reads the destructuring of the first parameter. List
`options.fixtures` when the property needs a fixture purely for its side
effect (a server that must be running) without destructuring it:

```ts
test.prop(
  "api stays consistent",
  { payload: fc.json() },
  async (_fixtures, { payload }) => {
    /* … */
  },
  { fixtures: ["apiServer"], numRuns: 200 },
);
```

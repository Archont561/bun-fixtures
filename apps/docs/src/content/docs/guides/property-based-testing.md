---
title: Property-Based Testing
description: Generative tests with fast-check arbitraries over injected fixtures, with a per-sample fixture lifecycle.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


`test.prop(...)` combines `fast-check` arbitraries with fixture
injection from the root `@archont561/bun-test-utils` entrypoint: instead of hand-written examples, you state a property and the
runner generates hundreds of samples — and shrinks any failure down to a
minimal counterexample.

## Installation

`test.prop` ships inside `@archont561/bun-test-utils`, but `fast-check` is an optional peer.
Install it only in projects that use property tests:

```bash
bun add -d @archont561/bun-test-utils fast-check
```

## Writing a property test

```ts
import { test, expect } from "@archont561/bun-test-utils";

test.prop(
  "encoding is reversible",
  (fc) => ({ text: fc.string(), key: fc.integer({ min: 1, max: 255 }) }),
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

## Sharing and composing arbitrary definitions

An arbitrary definition is an ordinary record or factory. Export it from a
shared module and import it explicitly wherever a property needs it; there is
no registry or runtime definition-processing machinery. Wrap shared factories with
`defineArbitraries` from the helper-only `@archont561/bun-test-utils/pbt` subpath to get
contextual fast-check typing without importing `FastCheckApi` in each definition
file:

```ts
// arbitraries.ts
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";

export const userArbitraries = defineArbitraries((fc) => ({
  name: fc.string(),
  age: fc.nat(),
}));

export const adminUserArbitraries = defineArbitraries((fc) => ({
  ...userArbitraries(fc),
  permissions: fc.array(fc.constantFrom("read", "write")),
}));
```

The derived record reuses the base factory with ordinary object spread. Every
property test importing either factory infers generated values from its
arbitraries—no casts or per-test annotations are needed:

```ts
// admin.test.ts
import { expect, test } from "@archont561/bun-test-utils";
import { adminUserArbitraries } from "./arbitraries";

test.prop("admin permissions are non-empty", adminUserArbitraries, async (_fixtures, {
  name,
  age,
  permissions,
}) => {
  const displayName: string = name;
  const years: number = age;
  const grants: ("read" | "write")[] = permissions;

  expect(displayName.length).toBeGreaterThan(0);
  expect(years).toBeGreaterThanOrEqual(0);
  expect(grants.every((grant) => grant === "read" || grant === "write")).toBe(true);
});
```

`test.scenario.prop` accepts the same arbitrary record type, so generated keys are
available in the first scenario step and continue through the fluent chain.
The `fast-check` peer remains optional at runtime for projects that do not
execute property or property-scenario tests. TypeScript's strict declaration
checking requirement is noted in the [package README](https://github.com/Archont561/bun-test-utils/blob/main/packages/bun-test-utils/README.md).

## The fixture lifecycle per sample

A property test is one `bun test` case whose body re-executes hundreds of
times — so scope semantics matter more than usual:

| Scope | Across samples and shrinks |
| :-- | :-- |
| `session` / `file` | **Shared** — built once, reused for every sample |
| `test` (default) | **Rebuilt per sample** — fresh instance, torn down LIFO before the next one |

Under the hood this is the engine's
[`opts.iterate` protocol](/bun-test-utils/reference/api/#the-iteration-protocol-iterate):
every sample — and every candidate `fast-check` tries while shrinking a
failure — runs through `ctx.iterate`, which builds the test-scoped fixtures
fresh and unwinds them **even when the predicate throws**. A database
connection or temporary directory opened for one sample can never leak into
the next.

```ts
import { test, expect } from "@archont561/bun-test-utils";

test.prop(
  "orders survive a round-trip through the store",
  (fc) => ({ orders: fc.array(fc.record({ id: fc.uuid(), total: fc.nat() })) }),
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
case and reports that counterexample together with the replay seed.

## When to list fixtures explicitly

Auto-detection reads the destructuring of the first parameter. List
`options.fixtures` when the property needs a fixture purely for its side
effect (a server that must be running) without destructuring it:

```ts
test.prop(
  "api stays consistent",
  (fc) => ({ payload: fc.json() }),
  async (_fixtures, { payload }) => {
    /* … */
  },
  { fixtures: ["apiServer"], numRuns: 200 },
);
```

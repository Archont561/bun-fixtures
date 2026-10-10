---
title: Property-Based Testing
description: Generative tests with fast-check arbitraries and injected fixtures, with a fresh test-scoped lifecycle for every generated sample.
---

`test.prop` runs a property test. You describe the inputs with [fast-check](https://fast-check.dev/) arbitraries, state a property that must hold for them, and the runner generates many samples. If a sample fails, fast-check shrinks it to a minimal counterexample and reports the seed to replay it.

Fixtures work in property tests exactly as they do in ordinary tests.

## Installation

`test.prop` ships in `@archont561/bun-test-utils`. `fast-check` is an optional peer, so install it in projects that use property tests:

```bash
bun add -d @archont561/bun-test-utils fast-check
```

## Write a property test

```ts
import { expect, test } from "@archont561/bun-test-utils";

test.prop(
  "addition is commutative",
  (fc) => ({ a: fc.integer(), b: fc.integer() }),
  async (_fixtures, { a, b }) => {
    expect(a + b).toBe(b + a);
  },
  { numRuns: 100 },
);
```

- The **arbitrary factory** receives the `fast-check` API and returns a record of arbitraries, one per generated value.
- The **test body** receives the fixtures first, then the generated values.
- **Other options** such as `numRuns` and `seed` pass straight through to `fc.assert`.

## Use fixtures in a property

Destructure fixtures from the first parameter, exactly as in an ordinary test. The engine detects them:

```ts
test.prop(
  "orders survive a round trip through the store",
  (fc) => ({ orders: fc.array(fc.record({ id: fc.uuid(), total: fc.nat() })) }),
  async ({ tmpdir }, { orders }) => {
    tmpdir.write("orders.json", JSON.stringify(orders));
    const saved = JSON.parse(tmpdir.read("orders.json"));
    expect(saved).toEqual(orders);
  },
  { numRuns: 50 },
);
```

`tmpdir` is test-scoped here, so each sample gets its own directory, and that directory is removed before the next sample starts.

## The fixture lifecycle per sample

A property test is one `bun test` case whose body runs many times. Scope decides what is shared between those runs:

| Scope | Across samples and shrink steps |
| :-- | :-- |
| `session` and `file` | **Shared.** Built once and reused for every sample. |
| `test` (default) | **Rebuilt for each sample.** A fresh instance, torn down before the next sample starts. |

Each sample, and each candidate fast-check tries while shrinking a failure, runs through the engine's iteration protocol. It builds the test-scoped fixtures, runs the body, and tears them down in LIFO order, even when the body throws. State left over from one sample cannot leak into the next.

Put expensive, read-only resources in `session` or `file` scope. Put anything a sample writes to in `test` scope. See [Scopes and teardown](/bun-test-utils/guides/scopes-and-teardown/).

## Share arbitrary definitions

An arbitrary definition is an ordinary record or factory. Export it from a shared module and import it wherever a property needs it:

```ts
// arbitraries.ts
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";

export const userArbitraries = defineArbitraries((fc) => ({
  name: fc.string(),
  age: fc.nat(),
}));

export const adminArbitraries = defineArbitraries((fc) => ({
  ...userArbitraries(fc),
  permissions: fc.array(fc.constantFrom("read", "write")),
}));
```

`defineArbitraries` is an identity function. It types the `fc` parameter contextually, so you do not need to import the `fast-check` type into every definition module. Generated values are inferred at each call site, so no casts are needed:

```ts
// admin.test.ts
import { expect, test } from "@archont561/bun-test-utils";
import { adminArbitraries } from "./arbitraries";

test.prop("admins have a valid name and permissions", adminArbitraries, async (_fixtures, { name, age, permissions }) => {
  const displayName: string = name;
  const years: number = age;
  const grants: ("read" | "write")[] = permissions;

  expect(displayName.length).toBeGreaterThanOrEqual(0);
  expect(years).toBeGreaterThanOrEqual(0);
  expect(grants.every((grant) => grant === "read" || grant === "write")).toBe(true);
});
```

`test.scenario.prop` accepts the same kind of arbitrary record, so generated values are available in the first scenario step. See [Scenarios and fluent API](/bun-test-utils/guides/scenarios-and-fluent-api/).

## Choose fixtures explicitly

Auto-detection reads the destructured first parameter. If a property needs a fixture only for its side effect, such as a server that must be running, list it in `options.fixtures` instead:

```ts
test.prop(
  "the API accepts any JSON payload",
  (fc) => ({ payload: fc.json() }),
  async (_fixtures, { payload }) => {
    expect(JSON.parse(payload)).toBeDefined();
  },
  { fixtures: ["testServer"], numRuns: 200 },
);
```

## Shrinking and replay

When a sample fails, fast-check shrinks the input to the smallest failing case and reports the counterexample with the seed. Pass that seed as `{ seed: ... }` to replay the same sequence of samples.

## Requirements and limits

- `fast-check` must be installed in any project that runs a property test. Projects without property tests do not need it at runtime.
- With `skipLibCheck: false`, TypeScript also needs `fast-check` installed to check the published declarations. See the [package README](https://github.com/Archont561/bun-test-utils/blob/main/packages/bun-test-utils/README.md#optional-peers).

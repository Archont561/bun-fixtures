---
title: Parameterizing Tests
description: Run one test over several values with test.prop and fast-check arbitraries.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.

Parameterization in `bun-test-utils` is `test.prop` — the same mechanism the
[Property-Based Testing](/bun-test-utils/guides/property-based-testing/) guide describes for
generative tests. There is no separate `params` feature: it was removed before
`0.1.0`
([ADR 0020](https://github.com/Archont561/bun-test-utils/blob/main/.backlog/docs/adr/0020-remove-parameterized-fixtures.md))
because two mechanisms for "run this test over several values", with different
case identity and failure output, was one too many.

## A fixed matrix

`fc.constantFrom` turns a static list into an arbitrary, so a small matrix is a
property with one value per axis:

```ts
import { test, expect } from "@archont561/bun-test-utils";

test.prop(
  "renders the navigation bar",
  (fc) => ({
    viewport: fc.constantFrom("mobile", "desktop"),
    locale: fc.constantFrom("en", "pl"),
  }),
  async ({ tmpdir }, { viewport, locale }) => {
    // …assert the rendering for this combination
  },
  { numRuns: 20, seed: 20261007 },
);
```

Test-scoped fixtures are rebuilt and unwound LIFO for every sample, so each
combination gets a fresh fixture set; session and file fixtures stay shared for
the whole run. A seeded run replays exactly, and a failure shrinks to the
minimal counterexample.

## Coverage caveat

`fc.constantFrom` draws with replacement: `numRuns` controls how many samples
are drawn, so a small `numRuns` may not exercise every value. When *guaranteed
enumeration* is the requirement rather than a sample over values, use an
ordinary loop in the test body:

```ts
test("renders the navigation bar in every locale", async ({ tmpdir }) => {
  for (const locale of ["en", "pl"]) {
    // …
  }
});
```

## Migrating from `params`

Before `0.1.0`, a fixture definition could carry `params: [...]`, and every
requesting test was expanded into one case per value — the cartesian product
when several parameterized fixtures met — with the current value exposed as
`ctx.param` and encoded in the case name (`"renders [browser=chromium]"`).
That surface is gone: a `params` key is now ignored like any other unknown
fixture key, and `ctx.param` is not injected.

- A fixture's `params` becomes an arbitrary on the corresponding key of the
  property, and `ctx.param` becomes a generated value received in the test
  body's second parameter.
- The `[key=value]` case-name suffix disappears: one test runs every sample,
  and a failure reports the shrunk counterexample instead of the case name.
- The `fast-check` peer is required for the axis; install it with
  `bun add -d fast-check`.

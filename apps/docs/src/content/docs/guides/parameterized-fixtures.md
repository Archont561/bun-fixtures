---
title: Parameterized tests
description: Run one test over a matrix of values with test.prop and fc.constantFrom, with a fresh fixture lifecycle for each combination.
---

Parameterized tests run one test body over several values. In `bun-test-utils` that is `test.prop`: the same mechanism the [property-based testing](/bun-test-utils/guides/property-based-testing/) guide describes, used with a fixed set of values instead of random ones.

## A fixed matrix

`fc.constantFrom` turns a list of values into an arbitrary. One arbitrary per axis gives you a matrix:

```ts
import { expect, test } from "@archont561/bun-test-utils";

test.prop(
  "renders the navigation bar",
  (fc) => ({
    viewport: fc.constantFrom("mobile", "desktop"),
    locale: fc.constantFrom("en", "pl"),
  }),
  async ({ tmpdir }, { viewport, locale }) => {
    tmpdir.write("config.json", JSON.stringify({ viewport, locale }));
    // assert the rendering for this combination
    expect(tmpdir.read("config.json")).toContain(viewport);
  },
  { numRuns: 20, seed: 20261007 },
);
```

Test-scoped fixtures are built and torn down for every sample, so each combination gets a fresh set. Session and file fixtures are shared across the whole run. A run with a fixed `seed` replays exactly, and a failure shrinks to the smallest counterexample.

## Coverage caveat

`fc.constantFrom` draws with replacement. `numRuns` sets how many samples are drawn, so a small `numRuns` may miss some values. When every value must run, use a plain loop in the test body:

```ts
test("renders the navigation bar in every locale", async ({ tmpdir }) => {
  for (const locale of ["en", "pl"]) {
    // assert the rendering for this locale
  }
});
```

Choose the form that matches the requirement. Use `test.prop` when sampling over a space is the point. Use a loop when every named case must run and report.

## Requirements

`test.prop` needs the optional `fast-check` peer:

```bash
bun add -d fast-check
```

## Next steps

- [Property-based testing](/bun-test-utils/guides/property-based-testing/) covers generated values, shrinking, and shared arbitrary definitions.
- [Scopes and teardown](/bun-test-utils/guides/scopes-and-teardown/) explains which fixtures are shared across samples.

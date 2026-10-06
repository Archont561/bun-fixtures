# Property-based testing

`bun-test-utils/pbt` adds fast-check properties to the fixture-aware test API. Install the optional generator dependency when needed:

> Property tests use the same explicit fixture model as ordinary tests. `fixtures.ts` and `conftest.ts` are not automatically loaded; call `test.extend()` and use the returned `test.prop` when a property needs fixtures.

```bash
bun add -d bun-test-utils fast-check
```

## A property test

```ts
import { expect, fc, test } from "bun-test-utils/pbt";

test.prop(
  "reversing twice preserves a string",
  { value: fc.string() },
  async (_fixtures, { value }) => {
    expect(value.split("").reverse().reverse().join("")).toBe(value);
  },
  { numRuns: 100 },
);
```

Generated values are the second callback argument. Fixtures are the first argument and can be auto-detected or listed with `fixtures`.

## Properties with scenarios

Generated values and values returned from `given` and `when` are available in every later step:

```ts
test.scenario.prop("calculates a total", {
  price: fc.integer({ min: 0, max: 100 }),
})
  .given("a quantity", () => ({ quantity: 2 }))
  .when("the total is calculated", ({ price, quantity }) => ({
    total: price * quantity,
  }))
  .then("the total is non-negative", ({ total, expect }) => {
    expect(total).toBeGreaterThanOrEqual(0);
  });
```

Session and file fixtures are shared across generated samples. Test-scoped fixtures are rebuilt and torn down for every sample and shrink attempt.

## Options

`numRuns`, `seed`, shrinking controls, `timeout`, and explicit `fixtures` are accepted through the property options. `fc` is re-exported for composing arbitraries.

See the [property testing guide](https://archont561.github.io/bun-test-utils/guides/property-based-testing/) and [`tests/`](./tests/) for lifecycle and shrinking examples.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

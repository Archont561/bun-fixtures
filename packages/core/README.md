# Core fixture engine

`@bun-test-utils/core` is the private workspace that powers the published `bun-test-utils` package. Consumers install `bun-test-utils`; this README documents the engine's normal public test API.

## A fixture-aware test

```ts
import { expect, test } from "bun-test-utils";

test("uses a typed fixture", async ({ user }) => {
  expect(user.name).toBe("Ada");
});
```

Compose fixtures explicitly with `extend`:

```ts
import { test as base } from "bun-test-utils";

export const test = base.extend({
  user: {
    setup: async (use) => {
      await use({ name: "Ada" });
    },
  },
});
```

`await use(value)` separates setup from teardown. `session`, `file`, and `test` scopes control lifetime; dependencies are resolved before the fixture and teardown is LIFO.

## Fluent scenarios

Scenario steps share one context. Values returned by `given` and `when` are available to later steps, and multiple steps can be chained:

```ts
test.scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .when("the user is created", ({ name }) => ({ user: { id: 1, name } }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBe(1);
  })
  .then("the name is retained", ({ user, expect }) => {
    expect(user.name).toBe("Ada");
  });
```

## Declaring fixtures

Use the public helper when creating reusable fixture packs:

```ts
import { createFixture } from "bun-test-utils";

export const clock = createFixture({
  scope: "test",
  setup: async (use) => {
    await use({ now: () => new Date(0) });
  },
});
```

The full lifecycle, parameterization, error, and iteration API is documented in the [API reference](https://archont561.github.io/bun-test-utils/reference/api/).

## Tests

Core behaviour is exercised in [`tests/`](./tests/), including scopes, dependency ordering, teardown, parameterization, scenario chains, and collection-time validation. The assembled public surface is covered by the [conformance tests](../bun-test-utils/tests/conformance/).

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

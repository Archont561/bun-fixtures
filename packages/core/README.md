# Core fixture engine (internal)

`@bun-test-utils/core` is the private workspace that powers the published `bun-test-utils` package. End users import `describe`, `test`, `expect`, and the typed schema wrapper `propTestSchema` from `bun-test-utils`; core helpers and fixture-pack helpers remain internal implementation details.

## Explicit composition only

There is no implicit fixture discovery. `fixtures.ts` and `conftest.ts` are not automatically loaded, and fixtures are not inherited by directory. Compose project fixtures with `test.extend()` and import that runner wherever the fixtures are needed.

```ts
// test.ts
import { test as base } from "bun-test-utils";

export const test = base.extend({
  db: {
    scope: "file",
    setup: async (use) => {
      const db = await createDatabase();
      await use(db);
      await db.close();
    },
  },
});
```

```ts
// users.test.ts
import { expect } from "bun-test-utils";
import { test } from "./test";

test("uses the explicit fixture", async ({ db }) => {
  expect(await db.health()).toBe("ok");
});
```

`await use(value)` separates setup from teardown. `session`, `file`, and `test` scopes control lifetime; dependencies are resolved before the fixture and teardown is LIFO.

## Fluent scenarios

Scenario steps share one context. Values returned by `given` and `when` are available to later steps, and multiple steps can be chained:

```ts
import { test } from "./test";

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

## Tests

Core behaviour is exercised in [`tests/`](./tests/), including explicit composition, scopes, dependency ordering, teardown, scenario chains, and collection-time validation. The assembled public surface is covered by the [conformance tests](../bun-test-utils/tests/conformance/).

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

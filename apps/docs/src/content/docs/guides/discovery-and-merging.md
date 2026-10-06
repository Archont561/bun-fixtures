---
title: Fixture composition
description: Compose fixtures explicitly with Playwright-style test.extend().
---

## Explicit composition

Fixtures are not discovered from `fixtures.ts` or `conftest.ts`. Define them in a module and
export a test runner created with `test.extend()`:

```ts
import { test as base } from "bun-test-utils";
import { stdFixtures } from "bun-test-utils/std";

export const test = base.extend({
  ...stdFixtures,
  database: {
    scope: "file",
    setup: async (use) => {
      const database = await createDatabase();
      await use(database);
      await database.close();
    },
  },
});
```

A test imports that runner directly:

```ts
import { test } from "./test";

test("uses the database", async ({ database }) => {
  // database is typed and scoped by the extension chain
});
```

## Extension chains

Calling `extend()` returns a new runner. Child modules can add or override fixtures without
scanning directories or relying on global state:

```ts
export const testWithUser = test.extend({
  user: {
    setup: async (use, { database }) => {
      await use(await database.createUser("Ada"));
    },
  },
});
```

The engine still resolves dependencies in topological order and applies session, file, and
test lifetimes with reverse-order teardown. Only the imported extension chain contributes
fixtures to a test.

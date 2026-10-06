---
title: Explicit fixture composition
description: Compose fixtures explicitly with Playwright-style test.extend().
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


## Explicit composition only

There is no implicit fixture discovery. `fixtures.ts` and `conftest.ts` are not
automatically loaded, and directories do not contribute fixtures to tests by
being parents or siblings. A fixture is available only when the test imports a
runner whose `test.extend()` chain includes that fixture. Built-in capabilities are already composed into the root `test` context.

Define fixtures in a module and export a test runner created with
`test.extend()`:

```ts
import { test as base } from "bun-test-utils";
export const test = base.extend({
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

## Migration from fixture files

Move any automatically loaded fixture map into an explicit `test.ts` (or any
module name you choose) and import that test runner from every test file that
needs the fixtures.

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

## Extension chains

Calling `extend()` returns a new runner. Child modules can add or override
fixtures without scanning directories or relying on global state:

```ts
export const testWithUser = test.extend({
  user: {
    setup: async (use, { database }) => {
      await use(await database.createUser("Ada"));
    },
  },
});
```

The engine still resolves dependencies in topological order and applies session,
file, and test lifetimes with reverse-order teardown. Only the imported extension
chain contributes fixtures to a test.

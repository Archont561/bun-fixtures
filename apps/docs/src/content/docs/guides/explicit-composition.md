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

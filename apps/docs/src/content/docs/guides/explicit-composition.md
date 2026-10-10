---
title: Explicit fixture composition
description: Compose fixtures with test.extend(), import the composed runner, and override built-in fixtures on purpose.
---

Fixtures are composed with `test.extend()`. A test gets exactly the fixtures in the runner it imports, and nothing else.

## Define a runner

Export a runner created with `test.extend()` from a module. The module is the complete definition of what its tests can request:

```ts
// test.ts
import { test as base } from "@archont561/bun-test-utils";

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

A test imports that runner:

```ts
// users.test.ts
import { test } from "./test";

test("uses the database", async ({ database }) => {
  // database is typed and scoped by the extension chain
});
```

## Extend a runner

Calling `extend()` returns a new runner. Child modules add fixtures without touching the parent:

```ts
// test-with-user.ts
import { test as databaseTest } from "./test";

export const test = databaseTest.extend({
  user: {
    setup: async (use, { database }) => {
      await use(await database.createUser("Ada"));
    },
  },
});
```

Some files need the database and the user. Others need only the database. Each imports the runner that matches its needs, and each runner is a small, explicit list.

## One namespace, last definition wins

All fixtures share one flat namespace, built-in capabilities included. When two definitions use the same name, the later one replaces the earlier one. That applies to your own fixtures and to built-ins:

```ts
import { test as base } from "@archont561/bun-test-utils";

// Replace the built-in clock for this project's tests.
export const test = base.extend({
  clock: {
    setup: async (use) => {
      await use({ now: () => new Date("2026-01-01T00:00:00Z") });
    },
  },
});
```

A dependency resolves by name, so a fixture that depends on `clock` receives your replacement as well. Use overrides deliberately: a replaced built-in changes the behaviour of every fixture and test that uses it.

The root runner contributes nineteen built-in names:

- Standard: `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`
- DOM: `window`, `document`, `page`
- Browser and server: `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`
- Cassettes: `cassette`
- Snapshots: `snapshot`

## Where fixtures come from

A test can request a fixture only when the imported runner's chain includes it, or when it is one of the built-in names. Directory position never adds a fixture. Two sibling test files that import different runners see different fixtures, even though they sit in the same folder.

Because the composition is explicit, a missing fixture fails with a message that lists the names the chain provides and shows the `test.extend()` call to add it.

## Next steps

- [Scopes and teardown](/bun-test-utils/guides/scopes-and-teardown/) for how long each fixture lives.
- [Built-in fixtures](/bun-test-utils/reference/plugins/) for what each built-in does.
- [API reference](/bun-test-utils/reference/api/) for the `test.extend()` signature.

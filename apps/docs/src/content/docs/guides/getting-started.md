---
title: Getting Started
description: How bun-test-utils composes fixtures with test.extend(), resolves dependencies, and tears them down.
---

`bun-test-utils` extends Bun's native test runner (`bun test`). It adds typed, scoped fixtures, composed explicitly with a Playwright-style `test.extend()` API, and a set of capabilities that are available on the same runner.

## How it works

You compose the fixtures a project needs in one module, and tests import the composed runner:

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

```ts
// database.test.ts
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("uses the database", async ({ database }) => {
  expect(await database.health()).toBe("ok");
});
```

When you call `test(...)`, the engine does four things:

1. **Resolves the fixtures the test requests** from its destructured parameter, or from `options.fixtures`.
2. **Orders them topologically**, so every fixture is built after the fixtures it depends on.
3. **Builds each fixture once for its scope** (session, file, or test), and injects the value.
4. **Tears fixtures down in reverse order** when their scope ends, including when the test fails.

Composition is explicit. A fixture is available to a test only when the imported `test.extend()` chain includes it. The engine never searches the file tree for fixture modules.

## Dependencies

A fixture declares its dependencies by destructuring them from the second parameter of `setup`:

```ts
user: {
  setup: async (use, { database }) => {
    await use(await database.createUser("Ada"));
  },
},
```

A fixture may depend only on fixtures of equal or longer lifetime. A `session` fixture cannot depend on a `test` fixture, for example. The engine checks this when the test is declared, so a mistake fails before any assertion runs. See [Scopes and teardown](/bun-test-utils/guides/scopes-and-teardown/).

## Typed context

The test context is typed from the `extend()` chain. Each fixture's value type comes from what its `setup` passes to `use`, so editors complete `user.name` or `database.health` without any annotations. Built-in capabilities are part of the same typed context.

## Errors

Diagnostics come from the engine with stable wording. The four messages below are part of the compatibility contract, and their placeholders vary:

- an unknown fixture, which lists what the imported chain provides;
- a circular dependency, with the cycle printed;
- a fixture that finished without calling `use(value)`;
- an unexpected `fetch` blocked by `networkGuard`.

Thrown capability errors also expose a machine-readable `code` and `details`. Prefer those in integrations. The full list is in the [API reference](/bun-test-utils/reference/api/#error-message-compatibility).

## Next steps

- [Explicit composition](/bun-test-utils/guides/explicit-composition/) shows how to structure fixture modules and override fixtures.
- [Scopes and teardown](/bun-test-utils/guides/scopes-and-teardown/) describes the lifetimes and teardown order.
- [Built-in fixtures](/bun-test-utils/reference/plugins/) lists what ships with the package.

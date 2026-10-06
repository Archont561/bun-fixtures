---
title: Getting Started
description: Deep dive into setting up bun-test-utils in your project.
---

`bun-test-utils` integrates directly with Bun's native test runner (`bun test`) and adds scoped, injectable fixtures through an explicit Playwright-style extension API.

## How it works

Import the base test and compose the fixtures your project needs:

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

A test imports that composed runner:

```ts
import { expect } from "bun-test-utils";
import { test } from "./test";

test("uses the database", async ({ database }) => {
  expect(await database.health()).toBe("ok");
});
```

The extension chain provides:

1. Explicit fixture ownership and composition.
2. Dependency resolution in topological order.
3. Session, file, and test-scoped lifetimes.
4. Reverse-order teardown, including when a test fails.
5. Typed fixture context based on the `extend()` chain.

`fixtures.ts` and `conftest.ts` are not automatically loaded. There is no implicit workspace scan; a fixture is available only when it is included in the imported `test.extend()` chain.

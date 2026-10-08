# 0002 — Legacy preload discovery and directory merge (superseded)

- **Status:** superseded by explicit fixture composition
- **Superseded by:** current public API based on `test.extend()` chains
- **Historical implementation:** removed from `packages/core/src/plugin.ts`

## Current decision

Implicit fixture discovery is no longer supported. The preload does not walk the
project tree, `fixtures.ts` and `conftest.ts` are not special filenames, and
fixtures are not inherited by parent or sibling directories.

A fixture is available to a test only when the test imports a runner whose
`test.extend()` chain includes that fixture, or when an integration explicitly
opens a fixture map through a documented API such as `openFixtures()`.

## Migration

```ts
// test.ts
import { test as base } from "@archont561/bun-test-utils";

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
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("uses the explicit fixture", async ({ db }) => {
  expect(await db.health()).toBe("ok");
});
```

## Historical note

Earlier milestones experimented with a pytest-style directory scanner. That
model was removed because it made fixture availability depend on filesystem
layout and preload side effects. This document is retained only to explain the
superseded design; it is not a supported behavior specification.

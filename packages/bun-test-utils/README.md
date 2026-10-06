# bun-test-utils

The single published package. It exposes only three named exports to end users:
`describe`, `test`, and `expect`.

```bash
bun add -d bun-test-utils
bunx test-utils init
```

## Public API shape

There are no public capability subpaths. Built-in capabilities are fixtures on
the root `test` context, and advanced runners hang off `test.*`:

- `test(...)` for ordinary fixture-aware tests.
- `test.extend(...)` for project fixtures and mocks.
- `test.prop(...)` for property tests.
- `test.scenario(...)` and `test.scenario.prop(...)` for BDD-style fluent tests.

Mocking should be expressed as fixtures so setup, dependency ordering, and
teardown remain in the fixture lifecycle.

## Explicit composition only

There is no implicit fixture discovery. `fixtures.ts` and `conftest.ts` are not automatically loaded, and fixtures are not inherited by directory. Use `test.extend()` and import the extended runner from each test file that needs those fixtures.

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

## Built-in fixtures

The root `test` includes standard, DOM, browser/server, VCR, and snapshot
fixtures in its context:

```ts
import { expect, test } from "bun-test-utils";

test("serves and snapshots a response", async ({
  testServer,
  serverUrl,
  snapshot,
}) => {
  testServer.handle(() => Response.json({ status: "ok" }));
  const response = await fetch(serverUrl);
  const body = await response.json();

  snapshot.match(body, "health");
  expect(body.status).toBe("ok");
});
```

## Property and scenario tests

```ts
import { expect, test } from "bun-test-utils";

test.prop(
  "calculates a total",
  (fc) => ({ price: fc.integer({ min: 0, max: 100 }) }),
  async ({ tmpdir }, { price }) => {
    tmpdir.write("price.txt", String(price));
    expect(Number(tmpdir.read("price.txt"))).toBe(price);
  },
);

test.scenario("chains every fluent phase")
  .given("a base value", () => ({ value: 2 }))
  .when("the value is incremented", ({ value }) => ({ result: value + 1 }))
  .then("the number is correct", ({ result, expect }) => {
    expect(result).toBe(3);
  });
```

All workspace packages are implementation boundaries; only `bun-test-utils` is published.

## Development

This package's conformance tests exercise the assembled public exports. The Gherkin scratch-project suite is in [`e2e/`](./e2e/) and features are in [`features/`](./features/).

```bash
bun run build
bun test packages/bun-test-utils
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

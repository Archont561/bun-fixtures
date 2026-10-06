# bun-test-utils

The published wrapper package. It bundles the core engine and capability packs behind one install with subpath imports.

```bash
bun add -d bun-test-utils
bunx test-utils init
```


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

## Cross-cutting examples

The root API combines fixtures with ordinary tests:

```ts
import { expect, test } from "bun-test-utils";

test("serves and snapshots a response", async ({ testServer, serverUrl, snapshot }) => {
  testServer.handle(() => Response.json({ status: "ok" }));
  const response = await fetch(serverUrl);
  const body = await response.json();

  snapshot.match(body, "health");
  expect(body.status).toBe("ok");
});
```

Property scenarios combine generated values, fixture context, and fluent steps:

```ts
import { fc, test } from "bun-test-utils/pbt";

test.scenario
  .prop("calculates a total", {
    price: fc.integer({ min: 0, max: 100 }),
  })
  .given("a quantity", () => ({ quantity: 2 }))
  .when("the total is calculated", ({ price, quantity }) => ({
    total: price * quantity,
  }))
  .then("the total is non-negative", ({ total, expect }) => {
    expect(total).toBeGreaterThanOrEqual(0);
  })
  .then("the total is even", ({ total, expect }) => {
    expect(total % 2).toBe(0);
  });
```

Values returned by `given` and `when` are merged into the next step's context. Session and file fixtures are shared across property samples; test fixtures are rebuilt per sample and shrink step.

## Included subpaths

| Import | Provides | Example |
| --- | --- | --- |
| `bun-test-utils` | Core test API and all built-in fixtures | [core README](../core/README.md) |
| `bun-test-utils/std` | `tmpdir`, `env`, `stdio` | [std README](../std/README.md) |
| `bun-test-utils/pbt` | `test.prop`, `scenario.prop`, `fc` | [pbt README](../pbt/README.md) |
| `bun-test-utils/dom` | Isolated happy-dom fixtures | [DOM README](../dom/README.md) |
| `bun-test-utils/browser` | HTTP server and Playwright fixtures | [browser README](../browser/README.md) |
| `bun-test-utils/vcr` | Fetch cassettes and callback replay | [VCR README](../vcr/README.md) |
| `bun-test-utils/snapshot` | Value and file snapshots | [snapshot README](../snapshot/README.md) |
| `bun-test-utils/bdd` | Gherkin lifecycle hooks | [BDD README](../bdd/README.md) |

All workspace packages are implementation boundaries; only `bun-test-utils` is published.

## Development

This package's conformance tests exercise the assembled public exports. The Gherkin scratch-project suite is in [`e2e/`](./e2e/) and features are in [`features/`](./features/).

```bash
bun run build
bun test packages/bun-test-utils
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

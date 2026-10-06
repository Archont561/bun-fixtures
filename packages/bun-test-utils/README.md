# bun-test-utils

The single published package. It exposes only three named exports to end users:
`describe`, `test`, and `expect`.

```bash
bun add -d bun-test-utils
bunx test-utils init
```

Optional test-style peers are installed only if you use those styles:

```bash
bun add -d fast-check # test.prop() / test.scenario.prop()
bun add -d @aboviq/bun-test-cucumber # test.scenario()
```

## Public API shape

There are no public capability subpaths. Built-in capabilities are fixtures on
the root `test` context, and advanced runners hang off `test.*`:

- `test(...)` for ordinary fixture-aware tests.
- `test.extend(...)` for project fixtures and mocks.
- `test.prop(...)` for property tests when `fast-check` is installed.
- `test.scenario(...)` for BDD-style fluent tests when `@aboviq/bun-test-cucumber` is installed.
- `test.scenario.prop(...)` when both optional peers are installed.

Mocking should be expressed as fixtures so setup, dependency ordering, and
teardown remain in the fixture lifecycle.

## Stability and platform support

The fixture engine plus the standard, DOM, snapshot, property-testing, and minimal
VCR capabilities are stable and follow semantic versioning. Browser and BDD are
experimental: **experimental capabilities may change in minor versions**.

The stable VCR surface is `cassette.record(callback)`,
`cassette.replay(callback)`, and exact HTTP replay matching by uppercase method
plus full URL. Matcher DSLs, configurable redaction, and cassette migration
support are deferred.

Linux and macOS are supported. Windows support is planned after the first
release; the current scratch-project harness and BDD presets rely on POSIX paths.

## Explicit composition only

There is no implicit fixture discovery. `fixtures.ts` and `conftest.ts` are not automatically loaded, and fixtures are not inherited by directory. Use `test.extend()` and import the extended runner from each test file that needs those fixtures.

The root runner contributes nineteen keys to one flat namespace:

- Standard: `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`
- DOM: `window`, `document`, `page`
- Browser: `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`
- VCR: `cassette`
- Snapshots: `snapshot`

Composition is last-definition-wins. A consumer fixture with one of these keys
intentionally replaces the built-in for that runner, and a later `extend()`
replaces an earlier definition. Dependencies continue to resolve by key and
therefore receive the override too.

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

The root `test` includes standard, DOM, browser/server, web mocking, VCR, and snapshot
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

## Web environment and HTTP mocks

`page` is always happy-dom and `browserPage` is always Playwright. Use `webPage`
when one test should be selectable by `BUN_TEST_UTILS_WEB_ENV=dom` (default) or
`BUN_TEST_UTILS_WEB_ENV=browser`. Use `httpMock` for MSW-like fetch handlers and
`browserHttpMock` for the same handlers installed on the Playwright context.

```ts
test("loads mocked data", async ({ webPage, httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  const user = await fetch("https://app.test/api/user").then((r) => r.json());

  await webPage.setContent(`<span id="name"></span>`);
  webPage.raw.document.querySelector("#name")!.textContent = user.name;
  expect(await webPage.textContent("#name")).toBe("Ada");
});
```

## Property and scenario tests

These APIs are present on `test`, but using them checks their optional peers and throws an actionable install message if the peer is missing.

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

## Error compatibility

Thrown capability errors expose machine-readable `code` and `details` when
available; those fields are preferred for integrations. Four human-readable
message templates are also contractual: unknown fixture, circular fixture
dependency, a fixture finishing without `use(value)`, and an unexpected fetch
blocked by `networkGuard`. Other diagnostic wording may change while its code
and meaning remain compatible. The exact templates are listed in the
[API specification](../../.backlog/docs/specs/0004-public-api-and-types.md).

All workspace packages are implementation boundaries; only `bun-test-utils` is published.

## Development

This package's conformance tests exercise the assembled public exports. Repo-wide Gherkin features live in `packages/*/features/*.feature` and are loaded by the shared `packages/config/bdd/features.test.ts` entrypoint.

```bash
bun run build
bun test packages/bun-test-utils
bun run test:bdd
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

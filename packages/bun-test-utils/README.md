# bun-test-utils

The single published package. The root runtime exports are `describe`, `expect`,
and `test`. Typed arbitrary-definition and scenario-step helpers live on the
`bun-test-utils/pbt` and `bun-test-utils/bdd` subpaths; global snapshot serializer
lifecycle helpers live on `bun-test-utils/snap`. These subpaths expose helpers,
not runners or fixture packs.

```bash
bun add -d bun-test-utils
bunx test-utils init
```

Optional test-style peers are installed only if you use those styles:

```bash
bun add -d fast-check # test.prop() / test.scenario.prop()
bun add -d @aboviq/bun-test-cucumber # test.scenario()
```

`fast-check` is optional at runtime. Its declarations are referenced by the
published root and `/pbt` `.d.ts` files to preserve typed arbitrary definitions, so
TypeScript consumers using `skipLibCheck: false` must install `fast-check` even
if they only use non-property root APIs. With `skipLibCheck: true`, ordinary
root imports typecheck without the peer; using property APIs still requires the
runtime peer.

## Public API shape

Built-in capabilities are fixtures on the root `test` context, and the test
runners hang off `test.*`. The helper subpaths are `bun-test-utils/pbt`,
`bun-test-utils/bdd`, and `bun-test-utils/snap`: PBT/BDD expose typed definitions,
while `/snap` exposes global snapshot serializer helpers. None exports a runner
or fixture pack.

- `test(...)` for ordinary fixture-aware tests.
- `test.extend(...)` for project fixtures and mocks.
- `test.prop(...)` for property tests when `fast-check` is installed.
- `defineArbitraries(...)` from `bun-test-utils/pbt` to define reusable fast-check arbitrary records or factories without importing the `FastCheckApi` type in each definition module.
- `givenStep(...)`, `whenStep(...)`, and `thenStep(...)` from `bun-test-utils/bdd` to contextually type reusable scenario callbacks.
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
support are deferred. `cassette.record` refuses a callback result that is not
plain data, such as a `Date`, `Map`, or `BigInt`, with the
`CALLBACK_NOT_SERIALIZABLE` error code.

Linux and macOS are supported. Windows support is planned after the first
release; the current scratch-project harness and BDD presets rely on POSIX paths.

Everything deliberately deferred out of `0.1.0` — database and filesystem-sandbox
fixtures, worker-scoped fixtures, Windows, the VCR matcher DSL and cassette
migration tooling — is listed with the condition that would unpark it in the
[roadmap](https://github.com/Archont561/bun-test-utils#roadmap--deliberately-deferred),
alongside what ships but is not yet frozen (header redaction, browser, BDD).
Deferrals are decisions, not oversights.

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

## Shared arbitrary definitions

A fast-check arbitrary record or factory can be explicitly imported from a shared module. Wrap a factory with `defineArbitraries` from `bun-test-utils/pbt` to contextually type its fast-check API argument without importing `FastCheckApi`; generated values are inferred at each `test.prop` and `test.scenario.prop` call site. The helper returns the definition unchanged, and arbitrary records compose with ordinary object spread.

```ts
// arbitraries.ts
import { defineArbitraries } from "bun-test-utils/pbt";

export const baseArbitraries = defineArbitraries((fc) => ({
  name: fc.string(),
  age: fc.nat(),
}));

export const adminArbitraries = defineArbitraries((fc) => ({
  ...baseArbitraries(fc),
  canManageUsers: fc.boolean(),
}));
```

```ts
// admin.test.ts
import { expect, test } from "bun-test-utils";
import { adminArbitraries } from "./arbitraries";

test.prop("generates typed admins", adminArbitraries, async (_fixtures, {
  name,
  age,
  canManageUsers,
}) => {
  const typedName: string = name;
  const typedAge: number = age;
  const canManage: boolean = canManageUsers;
  expect(typedName.length + typedAge + Number(canManage)).toBeGreaterThan(0);
});
```

## Shared scenario steps

Import `givenStep`, `whenStep`, and `thenStep` from `bun-test-utils/bdd` to contextually type shared scenario callbacks; the same subpath exports `GivenStep`, `WhenStep`, `ThenStep`, `ScenarioContext`, and `GivenChain` for explicit annotations. A consumer-owned sequence function can be imported into as many scenario files as needed. Imported step fixtures are auto-detected just like inline steps; compose project fixtures with `test.extend()` as usual. The [scenario guide](https://archont561.github.io/bun-test-utils/guides/scenarios-and-fluent-api/) has a complete example.

## Error compatibility

Thrown capability errors expose machine-readable `code` and `details` when
available; those fields are preferred for integrations. Four core human-readable
message templates are contractual: unknown fixture, circular fixture
dependency, a fixture finishing without `use(value)`, and an unexpected fetch
blocked by `networkGuard`. Snapshot serialization also has stable diagnostic
codes for circular values and custom serializer failures; see the
[snapshot guide](https://archont561.github.io/bun-test-utils/guides/snapshot-testing/)
and [snapshot spec](../../.backlog/docs/specs/0013-snapshot-testing.md).

All workspace packages are implementation boundaries; only `bun-test-utils` is published.

## Development

This package's conformance tests exercise the assembled public exports. Repo-wide Gherkin features live in `packages/*/features/*.feature` and are loaded by the shared `packages/config/bdd/features.test.ts` entrypoint.

```bash
bun run build
bun test packages/bun-test-utils
bun run test:bdd
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

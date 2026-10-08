---
title: API Reference
description: Public TypeScript API reference for bun-test-utils.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


## Public exports

The root package exposes the runner values `describe`, `expect`, and `test`:

```ts
import { describe, expect, test } from "@archont561/bun-test-utils";
```

Typed definition helpers live on two helper-only subpaths:

```ts
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";
import type { ArbitraryInput, FastCheckApi, GeneratedValues } from "@archont561/bun-test-utils/pbt";

import { givenStep, whenStep, thenStep } from "@archont561/bun-test-utils/bdd";
import type {
  GivenChain,
  GivenStep,
  ScenarioContext,
  ThenStep,
  WhenStep,
} from "@archont561/bun-test-utils/bdd";
```

`defineArbitraries` is an identity wrapper for an arbitrary record or factory; it
contextually types a factory's `fc` parameter and preserves generated types for
`test.prop` and `test.scenario.prop`. The phase-specific scenario wrappers
contextually type each callback's input and returned state, then return the
callback unchanged. See the [property-testing guide](/bun-test-utils/guides/property-based-testing/)
and [scenario guide](/bun-test-utils/guides/scenarios-and-fluent-api/).

These subpaths expose only typed definition helpers and aliases—not runners or
fixtures. Do not import `@archont561/bun-test-utils/std`, `@archont561/bun-test-utils/vcr`, or other
capability paths; fixtures and execution APIs remain on the root `test` object.

## Stability and platforms

The engine plus the standard, DOM, snapshot, property-testing, and minimal VCR
capabilities are stable and follow semantic versioning. Browser and BDD are
experimental: experimental capabilities may change in minor versions.

The stable VCR contract is `cassette.record(callback)`,
`cassette.replay(callback)`, and exact HTTP matching by uppercase method plus
full URL. Matcher DSLs, configurable redaction, and cassette migration tooling
are deferred.

Linux and macOS are supported. Windows support is planned after the first
release.

## `test(name, fn, options?)`

Defines a fixture-aware test. Requested fixtures are detected from the first
parameter's destructuring pattern and must exist in the imported `test.extend()`
chain or in the built-in root fixture set.

```ts
test("uses fixtures", async ({ tmpdir, env }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
});
```

### Test options

| Option | Type | Default | Behaviour |
| :-- | :-- | :-- | :-- |
| `fixtures` | `string[]` | auto-detected | Explicit fixture list, overriding auto-detection from the destructured parameter |
| `timeout` | `number` | Bun default | Per-test timeout in milliseconds, forwarded to `bun:test` |

## `test.extend(fixtures)`

Composes project fixtures and mocks explicitly:

```ts
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
  clock: {
    setup: async (use) => {
      await use({ now: () => new Date(0) });
    },
  },
});
```

Fixture scopes are `"session"`, `"file"`, and `"test"` (default). Dependencies are resolved before the fixture that requests them, and teardown after `await use(value)` runs in strict LIFO order.

All fixtures share one flat namespace. Composition is last-definition-wins: a
consumer fixture intentionally overrides a built-in with the same key, and a
later `extend()` overrides an earlier definition. Dependencies resolve by key,
so they receive the override as well.

## `test.prop(title, arbitraryFactory, fn, options?)`

Runs a property test. This optional API requires `fast-check` to be installed by
the project using it. The arbitrary factory receives the `fast-check` API; the
test callback receives fixtures first and generated values second.

```ts
test.prop(
  "encoding is reversible",
  (fc) => ({ text: fc.string(), key: fc.integer({ min: 1, max: 255 }) }),
  async ({ tmpdir }, { text, key }) => {
    tmpdir.write("value.txt", text);
    expect(decode(encode(tmpdir.read("value.txt"), key), key)).toBe(text);
  },
  { numRuns: 100 },
);
```

Every generated sample and shrink candidate gets fresh test-scoped fixtures;
session and file fixtures are shared across the property run.

## `test.scenario(title)` and `test.scenario.prop(title, arbitraryFactory)`

Builds one fixture-aware test from fluent `given`, `when`, and `then` steps.
This optional API requires `@aboviq/bun-test-cucumber` to be installed by the
project using it. Object results from `given` and `when` are merged into the next
context; fixture values are available alongside scenario state.

`test.scenario.prop(...)` additionally requires `fast-check`.

```ts
test.scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .when("the user is created", async ({ db, name }) => ({
    user: await db.users.create({ name }),
  }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBeDefined();
  });
```


## `webPage`: selectable DOM or Playwright execution

Use `page` when you want happy-dom semantics and `browserPage` when you want a
real Playwright `Page`. Those fixture names never silently switch meaning. When a
test should be able to run in either environment, request `webPage` and select
the backend with `BUN_TEST_UTILS_WEB_ENV=dom` (default) or
`BUN_TEST_UTILS_WEB_ENV=browser` / `playwright`.

```ts
test("renders in the selected web environment", async ({ webPage }) => {
  await webPage.setContent(`<button id="save">Save</button>`);
  await webPage.click("#save");
  const requested = process.env.BUN_TEST_UTILS_WEB_ENV?.toLowerCase();
  expect(webPage.mode).toBe(
    requested === "browser" || requested === "playwright" ? "browser" : "dom",
  );
});
```

`webPage.raw` is the underlying happy-dom window or Playwright page for
environment-specific assertions.

## `httpMock`: fixture-based response mocking

`httpMock` patches fetch for the current test and exposes an MSW-like handler API (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`, or `use`).
Unhandled requests pass through to the original `fetch`; use `reset()` between
phases and `calls()` for assertions.

```ts
test("loads mocked data", async ({ httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  httpMock.post(/\/api\/events$/, async (request) =>
    Response.json({ received: await request.json() }),
  );

  expect(await fetch("https://app.test/api/user").then((r) => r.json())).toEqual({
    name: "Ada",
  });
  expect(httpMock.calls()[0]).toMatchObject({ method: "GET", handled: true });

  httpMock.reset();
});
```

For Playwright tests, request `browserHttpMock` to install the same handlers on
the `browserContext`, or call `await httpMock.install(browserPage)` manually when
you need page-scoped routing.

## `describe` and `expect`

Re-exported directly from `bun:test` for convenience.

## Built-in fixture names

The root `test` includes these built-in fixtures:

- Standard: `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`
- DOM: `window`, `document`, `page`
- Browser/server: `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`
- VCR: `cassette`
- Snapshots: `snapshot`

## Error-message compatibility

Use machine-readable `code` and `details` for integrations when they are
available. These four human-readable message templates are also contractual:

```text
[bun-test-utils] unknown fixture "<NAME>" requested in <FILE>. Available in this explicit test.extend(...) chain: <AVAILABLE>. Compose the fixture with test.extend({ <NAME>: ... }) and import that extended test into this file.

[bun-test-utils] circular fixture dependency: <TRAIL> (<FILE>)

[bun-test-utils] fixture "<NAME>" finished without calling use(value)

[bun-test-utils] networkGuard blocked unexpected fetch: <METHOD> <URL>. Allow it explicitly with networkGuard.allow(...).
```

Placeholder values vary, but the surrounding wording and punctuation are
stable. Other diagnostic wording may change without changing its code or
meaning.

## Environment variables

| Variable | Behaviour |
| :-- | :-- |
| `BUN_TEST_UTILS_DEBUG` | Emits opt-in diagnostics to stderr when set to `1` |
| `BUN_TEST_UTILS_WEB_ENV` | Selects `webPage` backend: `dom` (default) or `browser` / `playwright` |
| `VCR_MODE` | Selects cassette mode: `record`, `replay`, or `passthrough` |
| `SNAPSHOT_MODE` | Selects snapshot mode: `match`, `update`, or `ci` |

There are no fixture discovery environment variables. The preload does not walk
your project tree, and `fixtures.ts` / `conftest.ts` are not special filenames.

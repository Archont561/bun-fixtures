---
title: API Reference
description: Every public export, option, fixture, error code, and environment variable of bun-test-utils.
---

## Imports

The root package exports the runner values `describe`, `expect`, and `test`:

```ts
import { describe, expect, test } from "@archont561/bun-test-utils";
```

Four helper-only subpaths export typed definitions and serializer contracts. They never export a runner or a fixture:

```ts
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";
import type { ArbitraryInput, FastCheckApi, GeneratedValues } from "@archont561/bun-test-utils/pbt";

import { givenStep, whenStep, thenStep } from "@archont561/bun-test-utils/bdd";
import type { GivenChain, GivenStep, ScenarioContext, ThenStep, WhenStep } from "@archont561/bun-test-utils/bdd";

import {
  createSnapshotSerializer,
  registerSnapshotSerializer,
  resetSnapshotSerializers,
  unregisterSnapshotSerializer,
} from "@archont561/bun-test-utils/snap";
import type { Serializer } from "@archont561/bun-test-utils/snap";

import { defineCallbackSerializer } from "@archont561/bun-test-utils/vcr";
import type { CallbackSerializer } from "@archont561/bun-test-utils/vcr";
```

- `/pbt`: `defineArbitraries` returns its argument unchanged and types the factory's `fc` parameter. The phase-specific scenario helpers in `/bdd` do the same for each callback's input and output. See [Property-based testing](/bun-test-utils/guides/property-based-testing/) and [Scenarios and fluent API](/bun-test-utils/guides/scenarios-and-fluent-api/).
- `/snap`: registers, unregisters, and resets process-wide snapshot serializers. See [Snapshot testing](/bun-test-utils/guides/snapshot-testing/).
- `/vcr`: `defineCallbackSerializer` defines reusable, reversible serializers for `cassette.addSerializer(...)`. See [Recording HTTP cassettes](/bun-test-utils/guides/recording-http-cassettes/).

Do not import `@archont561/bun-test-utils/std`, `/dom`, `/browser`, `/server`, or `/snapshot`, or any other internal workspace path. Fixtures and execution APIs live on the root `test` object.

## Stability and platforms

The fixture engine and the standard, DOM, snapshot, property-testing, and minimal cassette capabilities are stable and follow semantic versioning. Browser and BDD scenarios are experimental, and may change in minor versions.

The stable cassette contract is `cassette.record(callback)`, `cassette.replay(callback)`, and `cassette.addSerializer(serializer)`, with HTTP matching by the uppercase method and the full URL. Matcher DSLs, configurable redaction, and cassette migration tooling are not part of this release.

Linux and macOS are supported. Windows support is planned.

## `test(name, fn, options?)`

Defines a fixture-aware test. The fixtures it requests are read from the first parameter's destructuring pattern. Each must exist in the imported `test.extend()` chain, or be one of the built-in root fixtures.

```ts
test("uses fixtures", async ({ tmpdir, env }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
});
```

| Option | Type | Default | Behaviour |
| :-- | :-- | :-- | :-- |
| `fixtures` | `string[]` | auto-detected | Explicit fixture list. Replaces detection from the destructured parameter. |
| `timeout` | `number` | Bun's default | Per-test timeout in milliseconds, passed to `bun:test`. |
| `iterate` | `boolean` | `false` | Defers test-scoped fixtures and provides `ctx.iterate(fn)`. See below. |

### The iteration protocol (`iterate`)

With `iterate: true`, the outer context builds only `session`- and `file`-scoped fixtures, and provides `ctx.iterate(fn)`. Each `await ctx.iterate(fn)` builds a fresh set of test-scoped fixtures for that one call, and tears them down in LIFO order afterwards, even when `fn` throws. `test.prop` and `test.scenario.prop` use this protocol, so each generated sample and each shrink step runs with its own test-scoped state.

## `test.extend(fixtures)`

Returns a new runner that includes your fixtures:

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

Each fixture definition takes:

| Field | Type | Default | Behaviour |
| :-- | :-- | :-- | :-- |
| `setup` | `(use, context) => void \| Promise<void>` | required | Builds the value and passes it to `use(value)`. Code after `await use(value)` is the teardown. |
| `scope` | `"session"` \| `"file"` \| `"test"` | `"test"` | How long the value lives. See [Scopes and teardown](/bun-test-utils/guides/scopes-and-teardown/). |
| `deps` | `string[]` | inferred | Explicit dependency list. Normally omitted: dependencies come from the destructured second parameter of `setup`. |

All fixtures share one flat namespace. Composition is last-definition-wins: a fixture with the same name as a built-in replaces it, and a later `extend()` replaces an earlier definition. Dependencies resolve by name, so they receive the replacement as well.

## `test.prop(title, arbitraryFactory, fn, options?)`

Runs a property test. It needs the optional `fast-check` peer. The arbitrary factory receives the `fast-check` API. The test body receives the fixtures first and the generated values second.

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

Each generated sample and each shrink step gets fresh test-scoped fixtures. Session and file fixtures are shared across the run. Options other than the fixture list pass through to `fc.assert`.

## `test.scenario(title)` and `test.scenario.prop(title, arbitraryFactory)`

Builds one fixture-aware test from fluent `given`, `when`, and `then` steps. It needs the optional `@aboviq/bun-test-cucumber` peer. Objects returned from `given` and `when` are merged into the next step's context, alongside fixture values.

`test.scenario.prop` also needs `fast-check`. It generates the initial context.

```ts
test
  .scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .when("the user is created", async ({ db, name }) => ({
    user: await db.users.create({ name }),
  }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBeDefined();
  });
```

## `webPage`: one fixture, two backends

`page` always uses happy-dom, and `browserPage` always uses Playwright. Their meaning never changes. To write a test that runs on either, request `webPage`. Choose the backend with `BUN_TEST_UTILS_WEB_ENV`: `dom` (the default) or `browser` (or `playwright`).

```ts
test("renders the button", async ({ webPage }) => {
  await webPage.setContent(`<button id="save">Save</button>`);
  await webPage.click("#save");
  expect(webPage.mode).toBe(process.env.BUN_TEST_UTILS_WEB_ENV === "browser" ? "browser" : "dom");
});
```

| Member | Behaviour |
| :-- | :-- |
| `mode` | `"dom"` or `"browser"`: the backend this test runs on. |
| `goto(url)` | Loads a page. On the DOM backend, it fetches the URL and sets the body. |
| `setContent(html)` / `mount(html)` | Replaces the page's content. |
| `click(selector)` / `type(selector, text)` | Interacts with an element. |
| `textContent(selector)` / `html()` | Reads the page. |
| `evaluate(fn)` | Runs `fn` in the page on the browser backend. On the DOM backend, `fn` runs with `this` set to the happy-dom window. |
| `raw` | The underlying happy-dom window or Playwright page. Use it only for backend-specific assertions. |

Write portable tests with the helper methods. Reach for `raw` only when you need a backend-specific API.

## `httpMock`: fetch handlers

`httpMock` patches `fetch` for the current test. It exposes an MSW-style API: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, and `use(method, matcher, responder)`. A matcher is a string, a `RegExp`, or a predicate.

```ts
test("loads mocked data", async ({ httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  httpMock.post(/\/api\/events$/, async (request) =>
    Response.json({ received: await request.json() }),
  );

  expect(await fetch("https://app.test/api/user").then((r) => r.json())).toEqual({ name: "Ada" });
  expect(httpMock.calls()[0]).toMatchObject({ method: "GET", handled: true });

  httpMock.reset();
});
```

| Member | Behaviour |
| :-- | :-- |
| `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `use` | Registers a responder. Return `undefined` from a responder to pass the request through. |
| `passthrough(matcher?)` | Lets matching requests reach the network. |
| `reset()` | Clears the handlers. Use it between phases. |
| `calls()` | Lists the requests seen: method, URL, and whether a handler matched. |
| `install(page)` | Installs the same handlers on a Playwright page. Resolves to a cleanup function. |

Request `browserHttpMock` to install the handlers on the `browserContext` automatically.

## `cassette`: callbacks and HTTP recordings

| Member | Behaviour |
| :-- | :-- |
| `cassette(callback)` | Get-or-record callback wrapper. Local `auto` replays a hit and refreshes only a missing source with a visible warning; CI, explicit replay, ambiguity, and serializer errors stay strict. |
| `record(callback)` | Runs the callback once and stores its serializable result. Returns the result. |
| `replay(callback)` | Returns the stored result without running the callback. |
| `addSerializer(serializer)` | Registers a reversible, versioned serializer for this test's callback values. |
| `redactHeader(name)` | Redacts the named request header in recordings. Available, but outside the stable contract. |
| `mode`, `setMode(mode)` | The mode for this test: `auto`, `record`, `replay`, or `passthrough`. A mode explicitly set to `replay` keeps the callable strict. |

See [Recording HTTP cassettes](/bun-test-utils/guides/recording-http-cassettes/) for the full behaviour.

## `snapshot`: value and file snapshots

| Member | Behaviour |
| :-- | :-- |
| `match(value, name?)` | Compares a value against the stored snapshot, or records it on first run. |
| `matchFile(path, name?)` | Compares the contents of a file. |
| `addSerializer(serializer)` | Registers a serializer for this test. Return `undefined` for values it does not handle. |
| `mode`, `setMode(mode)` | `"match"`, `"update"`, or `"ci"`. |
| `path` | The path of this test's snapshot file. |

See [Snapshot testing](/bun-test-utils/guides/snapshot-testing/).

## Built-in fixture names

The root `test` context includes these built-in fixtures. [Built-in fixtures](/bun-test-utils/reference/plugins/) describes each one.

- Standard: `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`
- DOM: `window`, `document`, `page`
- Browser and server: `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`
- Cassettes: `cassette`
- Snapshots: `snapshot`

## Error-message compatibility

Use the machine-readable `code` and `details` of a thrown error in integrations, where available. The four messages below are part of the compatibility contract. Their placeholders vary, but the wording and punctuation around them are stable:

```text
[bun-test-utils] unknown fixture "<NAME>" requested in <FILE>. Available in this explicit test.extend(...) chain: <AVAILABLE>. Compose the fixture with test.extend({ <NAME>: ... }) and import that extended test into this file.

[bun-test-utils] circular fixture dependency: <TRAIL> (<FILE>)

[bun-test-utils] fixture "<NAME>" finished without calling use(value)

[bun-test-utils] networkGuard blocked unexpected fetch: <METHOD> <URL>. Allow it explicitly with networkGuard.allow(...).
```

Other diagnostic wording may change without changing its code or meaning.

### Error codes

| Code | Raised when |
| :-- | :-- |
| `UNKNOWN_FIXTURE` | A test requests a fixture that the imported chain does not provide. |
| `SCOPE_MISMATCH` | A fixture depends on a shorter-lived fixture. Raised when the test is declared. |
| `CIRCULAR_DEPENDENCY` | Fixtures depend on each other in a cycle. |
| `FIXTURE_SETUP_FAILED` | A built-in fixture could not start the resource it provides, such as a browser that would not launch. The original error is the `cause`. |
| `FIXTURE_USE_NOT_CALLED` | A fixture's `setup` finished without calling `use(value)`. |
| `FIXTURE_USE_CALLED_TWICE` | A fixture's `setup` called `use(value)` more than once. |
| `MISSING_OPTIONAL_DEPENDENCY` | A capability needs an optional peer that is not installed. The message names the install command. |
| `CASSETTE_NOT_FOUND` | Replay mode found no cassette for the test. |
| `CASSETTE_MISMATCH` | A request is missing from an existing cassette. The message names the command that clears it. |
| `CALLBACK_AMBIGUOUS` | One callback source text was recorded from more than one closure. |
| `CALLBACK_NOT_RECORDED` | A callback's source text has no recording. Re-record it. |
| `CALLBACK_NOT_SERIALIZABLE` | A callback returned a value that is not plain data and that no serializer handles. |
| `CALLBACK_SERIALIZER_NOT_FOUND` | A recording needs a serializer that is not registered. |
| `CALLBACK_SERIALIZER_FAILED` | A serializer threw. The original error is the `cause`. |
| `CALLBACK_STORE_INVALID` | A callback sidecar file is corrupt. |
| `INVALID_API_USAGE` | A capability or command was called with arguments or in a state it does not support. |
| `SNAPSHOT_CIRCULAR_REFERENCE` | A snapshot value contains a cycle. |
| `SNAPSHOT_SERIALIZER_FAILED` | A snapshot serializer threw. The original error is the `cause`. |

## Environment variables

| Variable | Behaviour |
| :-- | :-- |
| `BUN_TEST_UTILS_DEBUG` | Set to `1` to print opt-in diagnostics to stderr. |
| `BUN_TEST_UTILS_WEB_ENV` | Selects the `webPage` backend: `dom` (default), or `browser` / `playwright`. |
| `VCR_MODE` | Selects the cassette mode: `auto` (default), `record`, `replay`, or `passthrough`. |
| `SNAPSHOT_MODE` | Selects the snapshot mode: `match` (default), `update`, or `ci`. `ci` is selected automatically when `CI` is set. |
| `CI` | Makes `auto` cassettes refuse to record, and makes snapshots run in `ci` mode. |

The preload does not read your project's files for fixtures. Fixtures come only from the runners you import.

---
title: Built-in fixtures
description: Root test-context fixtures for standard, DOM, browser, VCR, snapshot, and property testing.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


## Public surface

The root `bun-test-utils` entrypoint exposes the runner values `describe`, `expect`, and `test`. The only public helper subpaths are `bun-test-utils/pbt` for reusable typed fast-check schemas and `bun-test-utils/bdd` for typed scenario-step callbacks; neither subpath exposes a runner or fixture pack. Request built-in capabilities by destructuring fixtures from the root `test` context.

```ts
import { expect, test } from "bun-test-utils";

test("uses built-in fixtures", async ({ tmpdir, env, cassette, snapshot }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
  snapshot.match({ mode: tmpdir.read("mode.txt") }, "mode");
  const readMode = () => tmpdir.read("mode.txt");
  await cassette.record(readMode);
  expect(await cassette.replay(readMode)).toBe("test");
});
```


## Repo-wide BDD gate

The repository's behavioural specs live under `packages/*/e2e/bdd/features/*.feature`,
and each package loads its own through a one-line `e2e/bdd/features.test.ts` entrypoint
that calls the shared `runPackageFeatures` helper. Run the same gate locally and in CI
with:

```bash
bun run test:bdd
```

A layout conformance test asserts the other half: every package that owns feature files
has that entrypoint, and that the entrypoint is exactly the one-line helper call — so the
wiring cannot drift package by package. Package-local `bunfig` files are not required for
Gherkin discovery.

## Fixtures

### Standard

- `clock`: Frozen or controlled system time, restored on teardown.
- `seed`: Deterministic `Math.random` sequences with replayable seed reporting.
- `networkGuard`: Blocks unexpected fetches unless explicitly allowed.
- `tmpdir`: Isolated temporary directory with helper methods (`write`, `read`, `exists`, `remove`, `path`) and automatic recursive wipe.
- `env`: Environment variable sandboxing with exact restoration on teardown.
- `stdio`: Output capture for stdout and stderr, with the real streams handed back on teardown.

### DOM

- `window`, `document`, and `page`: In-memory DOM fixtures powered by `happy-dom`, with automatic global cleanup.
- `webPage`: A portable page helper that uses happy-dom by default and switches to real Playwright only when `BUN_TEST_UTILS_WEB_ENV=browser` (or `playwright`) is set. `page` and `browserPage` keep their original semantics.

### Browser and server (experimental)

Browser capability APIs may change in minor versions.

- `testServer` and `serverUrl`: Ephemeral `Bun.serve` server on random port 0 with automatic shutdown.
- `browser`, `browserPage`, `browserContext`: Playwright browser automation, loaded only when requested.
- `httpMock`: MSW-like `get` / `post` / `put` / `patch` / `delete` / `head` / `options` handlers for fetch-based tests, plus `passthrough`, `reset`, and `calls()` assertions.
- `browserHttpMock`: The same mock helper installed on the Playwright `browserContext`; use `httpMock.install(browserPage)` for page-scoped routes.

### VCR

The stable VCR surface is deliberately minimal:

- `cassette.record(callback)`: executes a callback and stores its serializable result.
- `cassette.replay(callback)`: returns that result without executing the callback.
- HTTP replay matches uppercase method plus exact full URL only.

The current implementation writes under `__cassettes__/`, but its schema is not
yet a stable public format. Matcher DSLs, configurable redaction, and migration
tooling are deferred.

### Snapshots

- `snapshot`: Serializes a value (or a file's contents via `matchFile`) and compares it against a stored snapshot.
- Automatic snapshot files live at `__snapshots__/<test name>.snap.json` next to the test file.
- `match` / `update` / `ci` modes are available through the fixture API or the `SNAPSHOT_MODE` environment variable.

### Property and BDD-style tests

- `test.prop(title, factory, fn, options)`: stable property tests with per-sample fixture teardown. Requires the optional `fast-check` peer.
- `test.scenario(title)`: experimental fluent `given` / `when` / `then` scenarios using the same fixture context. Requires the optional `@aboviq/bun-test-cucumber` peer and may change in minor versions.
- `test.scenario.prop(title, factory)`: experimental generated values plus fluent scenarios. Requires both optional peers.


```ts
import { expect, test } from "bun-test-utils";

test("mocks fetch through a fixture", async ({ httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));

  const data = await fetch("https://app.test/api/user").then((r) => r.json());
  expect(data).toEqual({ name: "Ada" });
  expect(httpMock.calls()).toHaveLength(1);
});
```

Mocking should be expressed as fixtures and composed with `test.extend()` so mocks get dependency ordering and teardown just like built-in capabilities.

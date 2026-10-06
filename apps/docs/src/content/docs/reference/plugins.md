---
title: Built-in fixtures
description: Root test-context fixtures for standard, DOM, browser, VCR, snapshot, and property testing.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


## Public surface

`bun-test-utils` exposes only `describe`, `test`, and `expect`. There are no public capability subpaths. Request built-in capabilities by destructuring fixtures from the root `test` context.

```ts
import { expect, test } from "bun-test-utils";

test("uses built-in fixtures", async ({ tmpdir, env, cassette, snapshot }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
  snapshot.match({ mode: tmpdir.read("mode.txt") }, "mode");
  expect(cassette.path).toContain("__cassettes__");
});
```

## Fixtures

### Standard

- `tmpdir`: Isolated temporary directory with helper methods (`write`, `read`, `exists`, `remove`, `path`) and automatic recursive wipe.
- `env`: Environment variable sandboxing with exact restoration on teardown.
- `stdio`: Output capture for stdout and stderr, with the real streams handed back on teardown.

### DOM

- `window`, `document`, and `page`: In-memory DOM fixtures powered by `happy-dom`, with automatic global cleanup.

### Browser and server

- `testServer` and `serverUrl`: Ephemeral `Bun.serve` server on random port 0 with automatic shutdown.
- `browser`, `browserPage`, `browserContext`: Playwright browser automation, loaded only when requested.

### VCR

- `cassette`: Intercepts `globalThis.fetch` to record live HTTP requests to disk and replay them offline.
- Automatic cassette files live at `__cassettes__/<test name>.json` next to the test file.
- `record` / `replay` / `passthrough` modes are available through the fixture API or the `VCR_MODE` environment variable.

### Snapshots

- `snapshot`: Serializes a value (or a file's contents via `matchFile`) and compares it against a stored snapshot.
- Automatic snapshot files live at `__snapshots__/<test name>.snap.json` next to the test file.
- `match` / `update` / `ci` modes are available through the fixture API or the `SNAPSHOT_MODE` environment variable.

### Property and BDD-style tests

- `test.prop(title, factory, fn, options)`: property tests with per-sample fixture teardown. Requires the optional `fast-check` peer.
- `test.scenario(title)`: fluent `given` / `when` / `then` scenarios using the same fixture context. Requires the optional `@aboviq/bun-test-cucumber` peer.
- `test.scenario.prop(title, factory)`: generated values plus fluent scenarios. Requires both optional peers.

Mocking should be expressed as fixtures and composed with `test.extend()` so mocks get dependency ordering and teardown just like built-in capabilities.

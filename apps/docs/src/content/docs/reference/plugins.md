---
title: Built-in fixtures
description: The built-in fixtures on the root test context, grouped by area, with the members each one provides.
---

Built-in capabilities are fixtures on the root `test` context. Request them by destructuring, exactly as you request your own fixtures. You do not compose them yourself, and you can override any of them with `test.extend()`.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("uses built-in fixtures", async ({ tmpdir, env, cassette, snapshot }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
  snapshot.match({ mode: tmpdir.read("mode.txt") }, "mode");

  const readMode = () => tmpdir.read("mode.txt");
  await cassette.record(readMode);
  expect(await cassette.replay(readMode)).toBe("test");
});
```

The root package exports only the runners `describe`, `expect`, and `test`. The helper subpaths `/pbt`, `/bdd`, `/snap`, and `/vcr` export typed definitions and serializer helpers. None of them exports a fixture.

## Standard

| Fixture | Members | Behaviour |
| :-- | :-- | :-- |
| `tmpdir` | `dir`, `path(...parts)`, `write(name, content)`, `read(name)`, `exists(name)`, `remove(name)` | An isolated temporary directory, removed recursively at teardown. `write` returns the file's path. |
| `env` | `set(key, value)`, `get(key)`, `delete(key)`, `snapshot()` | Changes environment variables for the test. Every change is reverted at teardown. |
| `stdio` | `stdout()`, `stderr()`, `output()`, `clear()` | Captures writes to `process.stdout` and `process.stderr` for the test. The real streams are restored at teardown. `console.*` output is not captured, so assert on `process.stdout.write` output or on the value directly. |
| `clock` | `freeze(time)`, `set(time)`, `now()` | Controls `Date` and time. `time` may be a string, a number, or a `Date`. Restored at teardown. |
| `seed` | `value`, `set(seed)`, `random()` | Makes `Math.random` deterministic from a seed. `set` restarts the sequence from a given seed, so a failing run can be replayed. |
| `networkGuard` | `allow(...matchers)`, `calls()` | Blocks `fetch` calls to hosts that are not allowed. `calls()` lists every request and whether it was allowed. |

Only tests that request `networkGuard` are guarded. In those tests, a `fetch` that is not allowed throws, naming the method and URL.

## DOM

| Fixture | Provides | Requires |
| :-- | :-- | :-- |
| `window` | The happy-dom window. | `happy-dom` |
| `document` | The happy-dom document. | `happy-dom` |
| `page` | The DOM helper: `mount(html)`, `querySelector(selector)`, `querySelectorAll(selector)`, `click(selector)`, `type(selector, text)`, `html()`, `clear()`. | `happy-dom` |

`page` always uses happy-dom. For a test that should run on happy-dom or a real browser, use `webPage` (see below).

## Web (either backend)

`webPage` picks its backend from `BUN_TEST_UTILS_WEB_ENV`: `dom` (the default, using happy-dom) or `browser` (or `playwright`, using a real Playwright page). Its members are the same on both backends:

- `mode`: the backend this test runs on, `"dom"` or `"browser"`.
- `goto(url)`, `setContent(html)`, `mount(html)`
- `click(selector)`, `type(selector, text)`
- `textContent(selector)`, `html()`
- `evaluate(fn)`
- `raw`: the underlying happy-dom window or Playwright page, for backend-specific assertions.

## Browser (experimental)

Browser fixtures launch headless Chromium through Playwright. They need the `playwright` peer and an installed browser binary (`bunx playwright install chromium`). They are loaded only when requested, and the browser API may change in a minor release.

| Fixture | Provides |
| :-- | :-- |
| `browser` | A Playwright `Browser`, shared for the test. |
| `browserContext` | A Playwright `BrowserContext` for the test. |
| `browserPage` | A Playwright `Page` in that context. |
| `browserHttpMock` | The `httpMock` handlers installed on the `browserContext`. |

`browserPage` and `page` keep their own meanings. Use `webPage` when one test should run on either backend.

## Server and HTTP

| Fixture | Provides |
| :-- | :-- |
| `testServer` | An ephemeral `Bun.serve` server on a random port, shut down at teardown. Members: `url`, `port`, `server`, `handle(fn)`. |
| `serverUrl` | The same URL as `testServer.url`, declared as a dependency. |
| `httpMock` | MSW-style fetch handlers: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `use`, `passthrough`, `reset`, `calls`, `install`. |

`httpMock` lives with the server fixtures, not with the browser ones, so fetch-based tests never load Playwright. See [API reference](/bun-test-utils/reference/api/#httpmock-fetch-handlers) for the full member list.

## Cassettes

`cassette` records and replays callback results and HTTP traffic: `record(callback)`, `replay(callback)`, `addSerializer(serializer)`, and `redactHeader(name)`. See [Recording HTTP cassettes](/bun-test-utils/guides/recording-http-cassettes/).

## Snapshots

`snapshot` compares values and files against stored snapshots: `match(value, name?)`, `matchFile(path, name?)`, `addSerializer(serializer)`, `setMode(mode)`, and the `mode` and `path` properties. See [Snapshot testing](/bun-test-utils/guides/snapshot-testing/).

## Property and scenario tests

These are methods on `test`, not fixtures:

- `test.prop(title, arbitraries, fn, options?)` runs a property test. It needs `fast-check`. See [Property-based testing](/bun-test-utils/guides/property-based-testing/).
- `test.scenario(title)` and `test.scenario.prop(title, arbitraries)` build BDD-style scenarios. They need `@aboviq/bun-test-cucumber`, and scenarios are experimental. See [Scenarios and fluent API](/bun-test-utils/guides/scenarios-and-fluent-api/).

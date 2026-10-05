---
title: Plugins & Ecosystem
description: Official companion packages for standard, DOM, browser, and property testing.
---

## Official Companion Packages

### `@bun-fixture/std`

Zero-dependency standard fixtures — spread the bundle into your `fixtures.ts`:

```ts
import { stdFixtures } from "@bun-fixture/std";

export default {
  ...stdFixtures,
};
```

- `tmpdir`: Isolated temporary directory with helper methods (`write`, `read`, `exists`, `remove`, `path`) and automatic recursive wipe.
- `env`: Environment variable sandboxing with exact restoration on teardown.
- `stdio`: Output capture for stdout and stderr, with the real streams handed back on teardown.

### `@bun-fixture/fast-check`

Property-based testing integration — see the [Property-Based Testing guide](/bun-fixtures/guides/property-based-testing/):

- `test.prop(title, arbitraries, testFn, options)` combining `fast-check` with fixture injection.
- Requested fixtures auto-detect from `testFn`'s destructured first parameter (or `options.fixtures`).
- **Per-sample lifecycle**: session/file fixtures are shared across the run, while test-scoped fixtures are rebuilt and torn down (LIFO) for every generated sample — and every shrink step.

### `@bun-fixture/dom`

In-memory DOM simulation powered by `happy-dom`:

- `window`, `document`, and `page` fixtures with automatic global cleanup.

### `@bun-fixture/browser`

Headless browser & web server testing:

- `testServer` & `serverUrl`: Ephemeral `Bun.serve` server on random port 0 with automatic shutdown.
- `browser`, `browserPage`, `browserContext`: Session and test-scoped Playwright browser automation.

### `@bun-fixture/vcr`

HTTP Cassette recording and replaying — see the [Recording HTTP Cassettes guide](/bun-fixtures/guides/recording-http-cassettes/):

- `cassette`: Intercepts `globalThis.fetch` to record live HTTP requests to disk and replay them offline.
- **Automatic cassette files**: `__cassettes__/<test name>.json` next to the test file — auto-saved on teardown in record mode, auto-loaded at setup in replay mode, exposed as `cassette.path`.
- `record` / `replay` / `passthrough` modes via API or the `VCR_MODE` environment variable, with sensitive headers redacted by default.

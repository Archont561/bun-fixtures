---
title: Plugins & Ecosystem
description: Official companion packages for standard, DOM, browser, and property testing.
---

## Official Companion Packages

### `@bun-fixture/std`

Zero-dependency standard fixtures:
- `tmpdir`: Isolated temporary directory with helper methods (`write`, `read`, `exists`, `remove`, `path`).
- `env`: Environment variable sandboxing with automatic full restoration.
- `stdio`: Output capture for stdout and stderr.

### `@bun-fixture/fast-check`

Property-based testing integration:
- `test.prop(title, arbitraries, testFn, options)` combining `fast-check` with fixture injection and shrink-safe LIFO teardown.

### `@bun-fixture/dom`

In-memory DOM simulation powered by `happy-dom`:
- `window`, `document`, and `page` fixtures with automatic global cleanup.

### `@bun-fixture/browser`

Headless browser & web server testing:
- `testServer` & `serverUrl`: Ephemeral `Bun.serve` server on random port 0 with automatic shutdown.
- `browser`, `browserPage`, `browserContext`: Session and test-scoped Playwright browser automation.

### `@bun-fixture/vcr`

HTTP Cassette recording and replaying:
- `cassette`: Intercepts `globalThis.fetch` to record live HTTP requests to disk and replay them offline.

# 0011 — DOM and Browser Testing Support

- **Status:** ready
- **Implementation:** `packages/dom/`, `packages/browser/`
- **Tests:** `packages/dom/tests/`, `packages/browser/tests/`

## Problem

`bun:test` runs in a server-side JavaScript runtime. Frontend components (React, Vue, Svelte, Web Components) and E2E web application flows require either in-memory DOM simulation or full browser automation with clean per-test isolation.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `@bun-fixture/dom` MUST provide `window`, `document`, and `page` fixtures backed by `happy-dom`. |
| R2 | DOM fixtures MUST clean up global pollution (`globalThis.window`, `globalThis.document`) upon teardown. |
| R3 | `@bun-fixture/browser` MUST provide a session-scoped `browser` fixture (Playwright Chromium/Firefox/WebKit) launched once per test run. |
| R4 | `@bun-fixture/browser` MUST provide a test-scoped `page` / `context` fixture with isolated cookies and storage. |
| R5 | An ephemeral `serverUrl` fixture MUST be provided using `Bun.serve` on random free ports (`port: 0`) with automatic server shutdown on teardown. |

## Verification

- Component rendering and event dispatch tests using `@bun-fixture/dom`.
- Headless browser navigation and assertion tests using `@bun-fixture/browser`.

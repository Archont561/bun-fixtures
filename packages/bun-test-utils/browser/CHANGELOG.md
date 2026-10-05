# @bun-test-utils/browser

## 0.1.0

Initial release: headless browser and ephemeral test-server fixtures.

- `testServer` / `serverUrl` — ephemeral zero-configuration `Bun.serve` HTTP server on a random free port, shut down on test teardown.
- `browser` — session-scoped Playwright browser shared across the run; `browserContext` / `browserPage` — test-scoped isolated contexts and pages.
- Playwright is an optional dependency: only the browser fixtures need it installed.

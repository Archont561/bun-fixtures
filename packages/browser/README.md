# @bun-test-utils/browser

Private workspace. It provides the Playwright-backed browser fixtures, bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md):

| Fixture | Provides |
| :-- | :-- |
| `browser` | A headless Chromium `Browser`. |
| `browserContext` | A `BrowserContext` for the test. |
| `browserPage` | A Playwright `Page` in that context. |
| `browserHttpMock` | The `httpMock` handlers, installed on the context. |
| `webPage` | One helper that runs on happy-dom or a real Playwright page. The backend comes from `BUN_TEST_UTILS_WEB_ENV` (`dom` by default, or `browser` / `playwright`). |

These fixtures are loaded only when a test requests them. The `playwright` peer is required, along with an installed browser binary (`bunx playwright install chromium`).

Design points:

- **Headless only, Chromium only** ([ADR 0030](../../.backlog/docs/adr/0030-headless-only-browser-testing.md)). If a headless shell is not available to Playwright, the workspace falls back to the full Chromium build in its new headless mode.
- **Standard Playwright installation** ([ADR 0032](../../.backlog/docs/adr/0032-standard-playwright-install.md)) with CI verification of both launch paths ([ADR 0033](../../.backlog/docs/adr/0033-browser-ci-verification.md)).
- **Experimental.** The browser capability may change in a minor release.

`page` and `browserPage` keep their own meanings. `page` is always happy-dom, and `browserPage` is always Playwright.

## Develop

```bash
cd packages/browser
bun run test
bun run test:bdd
bun run typecheck
```

Browser suites run headless. In this repository, `bun run install-browsers` from the root installs the browser builds they use. On Linux, the pixi `browser` environment supplies the shared libraries. See the repository README for details.

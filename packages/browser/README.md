# Browser fixtures

`bun-test-utils/browser` covers ephemeral HTTP servers and Playwright browser sessions.

> Browser fixtures are included only by importing `bun-test-utils/browser` or composing `browserFixtures` with `test.extend()`. `fixtures.ts` and `conftest.ts` are not automatically loaded.

```bash
bun add -d bun-test-utils playwright
bunx playwright install chromium
```

## Test an HTTP service

```ts
import { expect, test } from "bun-test-utils/browser";

test("serves a JSON health response", async ({ testServer, serverUrl }) => {
  testServer.handle(() => Response.json({ status: "healthy" }));

  const response = await fetch(serverUrl);
  expect(await response.json()).toEqual({ status: "healthy" });
});
```

`testServer` selects a free port and stops the server after the test. `serverUrl` depends on it.

## Drive a real page

```ts
test("renders the server response", async ({ browserPage, testServer, serverUrl }) => {
  testServer.handle(() => new Response("<h1>Hello</h1>", {
    headers: { "content-type": "text/html" },
  }));

  await browserPage.goto(serverUrl);
  expect(await browserPage.textContent("h1")).toBe("Hello");
});
```

The `browser` fixture is session-scoped; `browserContext` and `browserPage` are isolated per test. Browser tests skip when Chromium is unavailable, while server tests need no browser binary.

See the [browser guide](https://archont561.github.io/bun-test-utils/reference/plugins/#bun-test-utilsbrowser) and [`tests/`](./tests/) for server lifecycle and Playwright cases.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

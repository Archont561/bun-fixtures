# @bun-fixture/browser

Headless browser and ephemeral test server fixtures for `bun-fixture`.

## Features

- **`testServer` / `serverUrl`**: Ephemeral zero-configuration `Bun.serve` HTTP server booted on random available ports (`port: 0`) with automatic teardown on test completion.
- **`browser`**: Session-scoped Playwright browser instance shared across test suites.
- **`browserPage` / `browserContext`**: Test-scoped isolated pages and contexts.

## Installation

```bash
bun add -d @bun-fixture/browser playwright
```

## Usage

In your `fixtures.ts`:

```ts
import browserFixtures from "@bun-fixture/browser";

export default {
  ...browserFixtures,
};
```

In your test file:

```ts
import { test, expect } from "bun-fixture";

test("serves and tests API endpoint", async ({ testServer, serverUrl }) => {
  testServer.handle((req) => new Response("Hello from Bun!"));

  const res = await fetch(serverUrl);
  expect(await res.text()).toBe("Hello from Bun!");
});
```

MIT

# Browser fixtures (internal)

The browser fixtures (`testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`) are internal workspace fixtures bundled into the public root `test` from `bun-test-utils`. There is no public `bun-test-utils/browser` subpath.

```ts
import { expect, test } from "bun-test-utils";

test("serves through the ephemeral test server", async ({ testServer, serverUrl }) => {
  testServer.handle(() => Response.json({ status: "ok" }));
  const response = await fetch(serverUrl);
  expect(await response.json()).toEqual({ status: "ok" });
});
```

Playwright is loaded by browser fixtures only when those fixtures are requested.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

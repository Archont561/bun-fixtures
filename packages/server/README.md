# Server fixtures (internal)

The `testServer`, `serverUrl`, and `httpMock` fixtures are internal workspace
fixtures bundled into the public root `test` from `@archont561/bun-test-utils`.
There is no public `@archont561/bun-test-utils/server` subpath.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("serves through the ephemeral test server", async ({ testServer, serverUrl }) => {
  testServer.handle(() => Response.json({ status: "ok" }));
  const response = await fetch(serverUrl);
  expect(await response.json()).toEqual({ status: "ok" });
});
```

`serverUrl` is a derived alias of `testServer.url` — the same value, declared as
a dependency so the engine resolves one fixture from the other.

`httpMock` is an MSW-like handler API over `fetch`. It never loads Playwright;
it lives here rather than in the browser pack for exactly that reason
([ADR 0031](../../.backlog/docs/adr/0031-server-fixtures-pack.md)).

```ts
test("mocks a response", async ({ httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  const data = await fetch("https://app.test/api/user").then((r) => r.json());
  expect(data).toEqual({ name: "Ada" });
});
```

For Playwright route interception inside a browser context, use
`browserHttpMock` from `@bun-test-utils/browser`, or call
`await httpMock.install(browserPage)` inside a test — `install` adapts the same
handlers onto Playwright routes.

These fixtures are exercised in [`tests/`](./tests/) through `test.extend(...)`
composition. The suite also pins the helper's exact property surface and proves
handlers registered in one test are not visible to the next.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

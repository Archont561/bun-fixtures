# @bun-test-utils/server

Private workspace. It provides the server and fetch-mocking fixtures, bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md):

| Fixture | Provides |
| :-- | :-- |
| `testServer` | An ephemeral `Bun.serve` server on a random port. `handle(fn)` sets the response, and the server shuts down at teardown. |
| `serverUrl` | The same URL as `testServer.url`, declared as a dependency so the engine resolves one from the other. |
| `httpMock` | MSW-style handlers for `fetch`: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `use`, `passthrough`, `reset`, `calls`, and `install`. |

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("serves through the ephemeral test server", async ({ testServer, serverUrl }) => {
  testServer.handle(() => Response.json({ status: "ok" }));
  expect(await (await fetch(serverUrl)).json()).toEqual({ status: "ok" });
});
```

`httpMock` lives here rather than in the browser workspace, so fetch-based tests never load Playwright ([ADR 0031](../../.backlog/docs/adr/0031-server-fixtures-pack.md)).

## Develop

```bash
cd packages/server
bun run test
bun run test:bdd
bun run typecheck
```

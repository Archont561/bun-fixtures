# Browser fixtures (internal)

> **Experimental:** browser capability APIs may change in minor releases. The
> Playwright peer and browser-binary path make this the heaviest CI capability.

The browser fixtures (`testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, and `browserHttpMock`) are internal workspace fixtures bundled into the public root `test` from `@archont561/bun-test-utils`. There is no public `@archont561/bun-test-utils/browser` subpath.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("serves through the ephemeral test server", async ({ testServer, serverUrl }) => {
  testServer.handle(() => Response.json({ status: "ok" }));
  const response = await fetch(serverUrl);
  expect(await response.json()).toEqual({ status: "ok" });
});
```

Playwright is loaded by browser fixtures only when those fixtures are requested.

`browserPage` is always a real Playwright `Page`; its semantics never switch. If
you want a portable helper, request `webPage`. It defaults to happy-dom and uses
Playwright only when `BUN_TEST_UTILS_WEB_ENV=browser` or `playwright` is set.

```ts
test("mocks a response", async ({ webPage, httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  const data = await fetch("https://app.test/api/user").then((r) => r.json());

  await webPage.setContent(`<span id="name"></span>`);
  webPage.raw.document.querySelector("#name")!.textContent = data.name;
  expect(await webPage.textContent("#name")).toBe("Ada");
});
```

For Playwright route interception, use `browserHttpMock` or call
`await httpMock.install(browserPage)` inside a test.

These fixtures are exercised in [`tests/`](./tests/) through `test.extend(...)` composition. The Playwright suite is the clearest illustration of scope: `browser` is session-scoped and therefore shared by consecutive tests, while `browserContext` and `browserPage` are test-scoped, so isolation is asserted *across* tests rather than by opening two contexts inside one.

There is no property-based suite here: a Playwright subprocess makes randomized runs slow and flaky, so algebraic coverage lives in vcr, snapshot, std, and the engine combinatorics hosted by `@bun-test-utils/pbt` (see [spec 0015](../../.backlog/docs/specs/0015-package-test-layout.md)).

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

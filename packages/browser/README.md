# Browser fixtures (internal)

> **Experimental:** browser capability APIs may change in minor releases. The
> Playwright peer and browser-binary path make this the heaviest CI capability.

The browser fixtures (`browser`, `browserContext`, `browserPage`, `webPage`, and
`browserHttpMock`) are internal workspace fixtures bundled into the public root
`test` from `@archont561/bun-test-utils`. There is no public
`@archont561/bun-test-utils/browser` subpath. The ephemeral server and
`httpMock` fixtures live in `@bun-test-utils/server`
([ADR 0031](../../.backlog/docs/adr/0031-server-fixtures-pack.md)).

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("clicks a button in the DOM backend", async ({ webPage }) => {
  await webPage.setContent(
    '<button id="inc">add</button><span id="count">0</span>',
  );
  webPage.raw.document.querySelector("#inc")!.addEventListener("click", () => {
    webPage.raw.document.querySelector("#count")!.textContent = "1";
  });
  await webPage.click("#inc");
  expect(await webPage.textContent("#count")).toBe("1");
});
```

Playwright is loaded by browser fixtures only when those fixtures are requested.

`browserPage` is always a real Playwright `Page`; its semantics never switch. If
you want a portable helper, request `webPage`. It defaults to happy-dom and uses
Playwright only when `BUN_TEST_UTILS_WEB_ENV=browser` or `playwright` is set.

For Playwright route interception, use `browserHttpMock` — it adapts the
`httpMock` handlers from `@bun-test-utils/server` onto a browser context — or
call `await httpMock.install(browserPage)` inside a test.

These fixtures are exercised in [`tests/`](./tests/) through `test.extend(...)`
composition. The Playwright suite is the clearest illustration of scope:
`browser` is session-scoped and therefore shared by consecutive tests, while
`browserContext` and `browserPage` are test-scoped, so isolation is asserted
*across* tests rather than by opening two contexts inside one.

There is no property-based suite here: a Playwright subprocess makes randomized
runs slow and flaky, so algebraic coverage lives in vcr, snapshot, std, and the
engine combinatorics hosted by `@bun-test-utils/pbt` (see
[spec 0015](../../.backlog/docs/specs/0015-package-test-layout.md)).

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

# DOM fixtures (internal)

The DOM fixtures (`window`, `document`, `page`) are internal workspace fixtures bundled into the public root `test` from `bun-test-utils`. There is no public `bun-test-utils/dom` subpath.

```ts
import { expect, test } from "bun-test-utils";

test("mounts markup and dispatches clicks", async ({ page }) => {
  page.mount(`<button id="add">add</button><span id="count">0</span>`);
  page.querySelector("#add")!.addEventListener("click", () => {
    page.querySelector("#count")!.textContent = "1";
  });
  page.click("#add");
  expect(page.html()).toContain(">1</span>");
});
```

`happy-dom` is loaded by the fixture only when a DOM fixture is requested.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

# DOM fixtures

`bun-test-utils/dom` provides an isolated in-memory DOM through happy-dom.

```bash
bun add -d bun-test-utils happy-dom
```

## Mount and interact with markup

```ts
import { expect, test } from "bun-test-utils/dom";

test("updates a counter through a click", async ({ page }) => {
  page.mount(`<button id="add">add</button><span id="count">0</span>`);
  page.querySelector("#add")?.addEventListener("click", () => {
    page.querySelector("#count")!.textContent = "1";
  });

  page.click("#add");
  expect(page.html()).toContain(">1</span>");
});
```

The `window`, `document`, and `page` fixtures share one isolated window for the test and restore global DOM objects during teardown. `page` also supports `mount`, `querySelector`, `querySelectorAll`, `type`, `click`, `html`, and `clear`.

See the [DOM guide](https://archont561.github.io/bun-test-utils/reference/plugins/#bun-test-utilsdom) and [`tests/`](./tests/) for query, typing, cleanup, and missing-element cases.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

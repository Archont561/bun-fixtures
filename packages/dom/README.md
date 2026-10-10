# @bun-test-utils/dom

Private workspace. It provides the in-memory DOM fixtures, bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md), built on [happy-dom](https://github.com/capricorn86/happy-dom):

- `window` and `document`: the happy-dom window and document for the test;
- `page`: a small helper with `mount(html)`, `querySelector`, `querySelectorAll`, `click(selector)`, `type(selector, text)`, `html()`, and `clear()`.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("mounts markup and dispatches clicks", async ({ page }) => {
  page.mount(`<button id="add">add</button><span id="count">0</span>`);
  page.querySelector("#add")!.addEventListener("click", () => {
    page.querySelector("#count")!.textContent = "1";
  });
  page.click("#add");
  expect(page.html()).toContain(">1</span>");
});
```

happy-dom is loaded only when a DOM fixture is requested, and the fixture removes its globals at teardown. Use `webPage` when a test should run either on happy-dom or on a real browser.

## Develop

```bash
cd packages/dom
bun run test
bun run test:bdd
bun run typecheck
```

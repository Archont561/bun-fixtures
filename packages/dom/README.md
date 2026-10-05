# @bun-fixture/dom

In-memory DOM and UI component testing fixtures for `bun-fixture` powered by `happy-dom`.

## Features

- **`window` & `document`**: High-performance in-memory DOM simulation with automatic global sandbox restoration.
- **`page`**: Intuitive DOM manipulation helper (`mount`, `querySelector`, `click`, `type`, `html`).
- **Clean Teardown**: Guarantees zero leaking of DOM globals across test runs.

## Installation

```bash
bun add -d @bun-fixture/dom happy-dom
```

## Usage

In your `fixtures.ts`:

```ts
import domFixtures from "@bun-fixture/dom";

export default {
  ...domFixtures,
};
```

In your test file:

```ts
import { test, expect } from "bun-fixture";

test("renders and clicks counter button", async ({ page }) => {
  page.mount(`
    <button id="counter">Count: 0</button>
  `);

  const btn = page.querySelector<HTMLButtonElement>("#counter");
  let count = 0;
  btn?.addEventListener("click", () => {
    count++;
    btn.textContent = `Count: ${count}`;
  });

  page.click("#counter");
  expect(btn?.textContent).toBe("Count: 1");
});
```

## License

Dual-licensed under either of [Apache-2.0](./LICENSE-APACHE) or
[MIT](./LICENSE-MIT) at your option — SPDX `MIT OR Apache-2.0`.

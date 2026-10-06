---
title: Parameterized Fixtures
description: Generate Cartesian product test combinations with parameterized fixtures.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


## Declaring Parameters

Fixtures can declare `params` to run every dependent test against each value:

```ts
// test.ts
export default {
  browser: {
    params: ["chromium", "firefox", "webkit"],
    setup: async (use, { param }) => {
      const b = await launchBrowser(param);
      await use(b);
      await b.close();
    },
  },
  
  viewport: {
    params: ["mobile", "desktop"],
    setup: async (use, { param }) => {
      await use(param === "mobile" ? { width: 375 } : { width: 1440 });
    },
  },
};
```

## Running Tests

When a test requests both fixtures:

```ts
test("renders navigation bar", async ({ browser, viewport }) => {
  // Runs 6 times (3 browsers x 2 viewports)!
});
```

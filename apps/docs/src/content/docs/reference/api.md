---
title: API Reference
description: Core TypeScript API reference for bun-fixture.
---

## Exports

### `test(name, fn, options?)`

Defines a fixture-aware test. Auto-detects requested fixtures from the first parameter's destructuring pattern.

```ts
test("my test", async ({ db }) => {
  // ...
}, { timeout: 5000, fixtures: ["db"] });
```

### `createTest(testFile?)`

Creates a test runner bound to an explicit file path (useful when stack trace inspection is not desired):

```ts
const { test, describe, expect } = createTest(import.meta.path);
```

### `expect` and `describe`

Re-exported directly from `bun:test` for convenience.

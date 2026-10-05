# @bun-fixture/fast-check

Property-Based Testing (PBT) integration for `bun-fixture` powered by `fast-check`.

## Features

- **`test.prop`**: Seamlessly combine `fast-check` Arbitraries with injected `bun-fixture` fixtures.
- **Fixture Lifecycle**: Preserves session and file fixtures across iteration runs.
- **Shrinking**: Automatically reports minimal counterexamples alongside active test fixtures.

## Installation

```bash
bun add -d @bun-fixture/fast-check fast-check
```

## Usage

```ts
import { test, expect, fc } from "@bun-fixture/fast-check";

test.prop(
  "encodes and decodes roundtrip cleanly",
  {
    text: fc.string(),
    key: fc.integer({ min: 1, max: 255 }),
  },
  async ({ tmpdir }, { text, key }) => {
    const encoded = text
      .split("")
      .map((c) => String.fromCharCode(c.charCodeAt(0) ^ key))
      .join("");
    const decoded = encoded
      .split("")
      .map((c) => String.fromCharCode(c.charCodeAt(0) ^ key))
      .join("");

    expect(decoded).toBe(text);
  },
  { numRuns: 100 }
);
```

MIT

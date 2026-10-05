# @bun-fixture/fast-check

Property-Based Testing (PBT) integration for `bun-fixture` powered by `fast-check`.

## Features

- **`test.prop`**: Seamlessly combine `fast-check` Arbitraries with injected `bun-fixture` fixtures — requested fixtures are auto-detected from the destructured first parameter, or listed explicitly via `opts.fixtures`.
- **Per-iteration Fixture Lifecycle**: session and file fixtures are shared across the whole property run, while test-scoped fixtures are rebuilt and torn down (LIFO) for every generated sample — and for every shrink step (powered by the engine's `opts.iterate` protocol).
- **Shrinking**: Automatically reports minimal counterexamples alongside the active fixture parameters.

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

## License

Dual-licensed under either of [Apache-2.0](./LICENSE-APACHE) or
[MIT](./LICENSE-MIT) at your option — SPDX `MIT OR Apache-2.0`.

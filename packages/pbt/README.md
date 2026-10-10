# @bun-test-utils/pbt

Private workspace. It provides property-based testing on top of [fast-check](https://fast-check.dev/), bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md):

- **`test.prop(title, arbitraryFactory, fn, options?)`** and **`test.scenario.prop`** on the root `test`. Each generated sample, and each shrink step, gets fresh test-scoped fixtures through the engine's iteration protocol.
- **`defineArbitraries`**, exported from the helper-only `@archont561/bun-test-utils/pbt` subpath. It types a factory's `fc` parameter contextually and returns the definition unchanged, so shared arbitrary records can be imported into any test.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test.prop(
  "reversing twice preserves a string",
  (fc) => ({ value: fc.string() }),
  async (_fixtures, { value }) => {
    expect(value.split("").reverse().reverse().join("")).toBe(value);
  },
  { numRuns: 100 },
);
```

`fast-check` is an optional peer. It is loaded only when a property API runs. The published declarations refer to it, so TypeScript projects with `skipLibCheck: false` must install it.

See the [property-based testing guide](https://archont561.github.io/bun-test-utils/guides/property-based-testing/) and [spec 0010](../../.backlog/docs/specs/0010-property-based-testing-fastcheck.md).

## Develop

```bash
cd packages/pbt
bun run test
bun run test:bdd
bun run typecheck
```

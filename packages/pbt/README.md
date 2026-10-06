# Property-based testing (internal)

Property testing is an internal workspace capability surfaced on the public root `test` as `test.prop(...)` and `test.scenario.prop(...)`. There is no public `bun-test-utils/pbt` subpath.

```ts
import { expect, test } from "bun-test-utils";

test.prop(
  "reversing twice preserves a string",
  (fc) => ({ value: fc.string() }),
  async (_fixtures, { value }) => {
    expect(value.split("").reverse().reverse().join("")).toBe(value);
  },
  { numRuns: 100 },
);
```

The first argument passed to the arbitrary factory is the `fast-check` API, loaded only after the user installs the optional `fast-check` peer and uses the property API. Fixtures are the first callback parameter and follow the same session/file/test lifecycles as ordinary tests.

The property API is exercised in [`tests/`](./tests/) through `test.extend(...)` composition, including the per-iteration fixture lifecycle: a test-scoped fixture is rebuilt and torn down around every generated sample and every shrink step, while session- and file-scoped fixtures are shared across them.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

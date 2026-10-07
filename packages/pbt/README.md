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

The first argument passed to the arbitrary factory is the `fast-check` API, loaded only after the user installs the optional `fast-check` peer and uses the property API. Fixtures are the first callback parameter and follow the same session/file/test lifecycles as ordinary tests. Wrap a shared factory in the root `propTestSchema` helper to get contextual typing without importing `FastCheckApi` in each schema module. Its type declarations are referenced by the public root declaration; strict consumer typechecks with `skipLibCheck: false` therefore require `fast-check` even for non-property root imports. Runtime loading remains lazy and optional; the package README documents this TypeScript tradeoff.

## Shared schemas

Schema factories are plain functions that can live in shared modules and be imported by any property-test file. The root `propTestSchema` wrapper contextually types a factory and preserves its inferred arbitrary record; `FastCheckApi`, `ArbitraryInput<T>`, and `GeneratedValues<T>` remain available as type-only root exports when consumers need to name those types explicitly.

```ts
// schemas.ts
import { propTestSchema } from "bun-test-utils";

export const userSchema = propTestSchema((fc) => ({
  name: fc.string(),
  age: fc.nat(),
}));

export const adminSchema = propTestSchema((fc) => ({
  ...userSchema(fc),
  permissions: fc.array(fc.constantFrom("read", "write")),
}));
```

```ts
// admin.test.ts
import { expect, test } from "bun-test-utils";
import { adminSchema } from "./schemas";

test.prop("generates typed admin records", adminSchema, async (_fixtures, {
  name,
  age,
  permissions,
}) => {
  const typedName: string = name;
  const typedAge: number = age;
  const typedPermissions: ("read" | "write")[] = permissions;
  expect(typedName.length + typedAge + typedPermissions.length).toBeGreaterThan(0);
});
```

Use explicit imports and ordinary object spread for composition. `propTestSchema` is an identity wrapper only: it does not register, inspect, or alter definitions. `test.scenario.prop` accepts the same factory type and preserves the generated value types through the scenario chain.

The property API is exercised in [`tests/`](./tests/) through `test.extend(...)` composition, including the per-iteration fixture lifecycle: a test-scoped fixture is rebuilt and torn down around every generated sample and every shrink step, while session- and file-scoped fixtures are shared across them.

Engine combinatorics that would otherwise live in `packages/core` — topological `resolveOrder` (the setup order LIFO teardown reverses) — are property-tested here so core never depends on this package. `dom` and `browser` have no property suites: the former is thin happy-dom glue, the latter a Playwright subprocess whose randomized runs would be slow and flaky.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

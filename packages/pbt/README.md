# @bun-test-utils/pbt

> **Internal workspace.** Bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as the
> `bun-test-utils/pbt` subpath; never published on its own.

Property-based testing with [fast-check](https://fast-check.dev) on top of fixture
injection. `test.prop` combines arbitraries with the fixture engine: session and file
fixtures are shared across samples, while test-scoped fixtures are **rebuilt and torn down
for every generated sample and every shrink step** — the engine's `opts.iterate` lifecycle
is what makes that per-iteration isolation possible.

```ts
import { expect, fc, test } from "bun-test-utils/pbt";

test.prop("reverses twice", [fc.string()], async ({ tmpdir }, value) => {
  expect(value.split("").reverse().reverse().join("")).toBe(value);
});
```

## Peer dependency

`fast-check` is an optional dependency — install it yourself if your package manager
skipped it:

```bash
bun add -d fast-check
```

Importing this subpath without it installed throws a clear error naming the missing
package; it never fails silently.

## Exports

| Export | Role |
| --- | --- |
| `test` / `test.prop` | Fixture-aware test with `.prop(name, arbitraries, fn, params?)` for property runs |
| `prop` | Standalone property runner (`createPropTest` binds it to an explicit file) |
| `fc` | fast-check re-export, for arbitraries and `fc.assert`-style helpers |
| `expect`, `describe` | Re-exported from `bun:test`, unchanged |
| `createPropTest(file?)` | `{ test, prop, ... }` bound to `import.meta.path` |
| `PropTestOptions`, `ArbitraryRecord`, `GeneratedValues` | Types; `PropTestOptions extends fc.Parameters` so fast-check settings pass straight through |

`params` accepts any fast-check run parameter (`numRuns`, `seed`, …) via `PropTestOptions`,
plus fixture test options (`fixtures?`, `timeout?`).

## Further reading

- Docs guide: [property-based testing](https://archont561.github.io/bun-test-utils/guides/property-based-testing/)
- Spec: [0010 property-based testing with fast-check](../../.backlog/docs/specs/0010-property-based-testing-fastcheck.md)
- Sources in `src/`, focused tests in `tests/`

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.

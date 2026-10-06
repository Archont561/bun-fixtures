# @bun-test-utils/core

> **Internal workspace.** This package is bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as its root
> entrypoint (`bun-test-utils`, aliased `bun-test-utils/plugin`); it is never published on
> its own. Install `bun-test-utils`, not this.

The pytest-style fixture engine for `bun test`: scoped, injectable fixtures that are
autodiscovered per directory, resolved by dependency, and torn down strictly in reverse.

`bun test` has no fixture API ([oven-sh/bun#8257](https://github.com/oven-sh/bun/issues/8257)).
This engine adds one without touching `bun:test`: a test names its dependencies in its
parameter list, and a preload resolves them from `fixtures.ts` files found by walking the
directory tree — the same idea as `conftest.py`.

```ts
import { test, expect } from "bun-test-utils";

test("creates a user", async ({ db }) => {
  expect(await db.insert({ name: "ada" })).toMatchObject({ id: 1 });
});
```

`db` was never imported, constructed, or reset here.

## Philosophy and model

### Setup is a dependency, not a prologue

A test should name what it needs and receive it. `beforeEach` chains describe *when* things
happen; fixtures describe *what a test depends on* and let the runner work out the order.

The design commitments behind that:

- **Teardown is the second half of setup.** One function owns both halves, split by the
  moment it hands the value over. Cleanup written far from the allocation rots.
- **Scope is a contract.** `session`, `file` and `test` say how long a value lives and
  therefore who may share it. A long-lived fixture may not depend on a short-lived one —
  it would outlive its own dependency.
- **The directory tree is the configuration.** Fixtures belong to the tests beneath them,
  and a nearer declaration wins. Moving a test to another folder changes what it can ask for.
- **Failures belong at registration.** Unknown names, dependency cycles and scope violations
  surface during collection, with the available fixtures listed — not as a mystery failure
  on test 47.
- **No magic, no globals.** `bun:test` is left untouched and `test` is an explicit import,
  opt-in per file. A file that does not import it behaves exactly as before.
- **A thin wrapper, deliberately.** If Bun ships a fixture API, this engine should become a
  compatibility shim and get out of the way.

### The model

A fixture is one object. `await use(value)` suspends until the scope ends, so everything
after it is teardown:

```ts
interface FixtureDef<T = any> {
  setup: (use: (value: T) => Promise<void>, ctx: FixtureContext) => void | Promise<void>;
  scope?: "session" | "file" | "test";  // default: "test"
  params?: T[];                         // multiplies the tests that use it
  deps?: string[];                      // explicit, when destructuring won't do
}
```

A representative `fixtures.ts` looks like this:

```ts
export default {
  server: {
    scope: "session",
    setup: async (use) => {
      const s = await startServer();
      await use(s);        // the tests run here
      await s.stop();      // …and this is guaranteed to follow
    },
  },

  db: {
    scope: "file",
    setup: async (use, { server }) => {   // ← dependency, by name
      const db = await server.connect();
      await use(db);
      await db.close();
    },
  },

  user: {
    setup: async (use, { db }) => {       // ← test scope (the default)
      await use(await db.insert({ name: "ada" }));
    },
  },
} satisfies FixtureMap;
```

| Scope | Built | Destroyed |
| --- | --- | --- |
| `"session"` | once per `bun test` run | after the run |
| `"file"` | once per test file | when the file is done |
| `"test"` | every test (**default**) | immediately after the test |

Teardown is **LIFO** — dependents before their dependencies.

### Discovery and merge

The preload walks the directory tree once at startup, collecting `fixtures.ts` /
`conftest.ts` files and merging them root → leaf: a nearer declaration wins, and a
directory cannot see its siblings' fixtures. Tests then resolve fixtures from the merged
map of the directories above them.

Parameterized fixtures expand into one `bun test` case per combination — the cartesian
product, including any parameterized fixture reached transitively:

```ts
mode:   { params: ["fast", "slow"], setup: async (use, { param }) => use(param) },
region: { params: ["eu", "us"],     setup: async (use, { param }) => use(param) },
```

```text
✓ round trips [mode=fast, region=eu]
✓ round trips [mode=fast, region=us]
✓ round trips [mode=slow, region=eu]
✓ round trips [mode=slow, region=us]
```

Mistakes are reported while tests are collected, not while they run:

```text
[bun-test-utils] unknown fixture "reel" requested in tests/api.test.ts. Available: db, server, user
[bun-test-utils] scope mismatch: "cache" (session) cannot depend on "tmp" (test) — a fixture
              may only use equally or longer-lived fixtures.
[bun-test-utils] circular fixture dependency: a → b → a (tests/api.test.ts)
```

Two environment variables override discovery: `BUN_TEST_UTILS_ROOT` sets the tree root, and
`BUN_TEST_UTILS_NO_AUTODISCOVER` disables the startup walk entirely.

## User-facing API

| Surface | API today | Role |
| --- | --- | --- |
| Test | `test(name, fn, opts?)` | Fixture-aware test; finds its own file from the stack. `opts`: `{ fixtures?, timeout?, iterate? }` |
| Test | `createTest(file?)` | `{ test, describe, expect }` bound to an explicit file — pass `import.meta.path` |
| Test | `expect`, `describe` | Re-exported from `bun:test`, unchanged |
| Iteration | `opts.iterate` → `ctx.iterate(fn)` | Defer test-scoped fixtures: each `ctx.iterate` call builds them fresh and unwinds them LIFO — the per-sample lifecycle property runners use (see [`@bun-test-utils/pbt`](../pbt)) |
| CLI | `bunx bun-test-utils init [--dir] [--entry] [--force]` | Append the preload to `bunfig.toml` and scaffold a root `fixtures.ts` |
| Types | `FixtureDef`, `FixtureMap`, `FixtureContext`, `Scope`, `TestOptions`, `IterateFn` | The public type surface |
| Engine | `discoverFixtures`, `fixturesFor`, `resolveOrder`, `paramCombos`, `detectFixtures`, `callerFile`, `teardownFile`, `teardownSession` | Internals exported for tooling and for testing fixture trees |

## Architecture

```text
                        bun test  +  [test].preload
                                   │
                                   ▼
                 discovery — walk the directory tree once
                 fixtures.ts / conftest.ts, merged root → leaf
                                   │
                                   ▼
                 resolution — dependencies, scopes, params
                                   │
          ┌─────────────┬──────────┴──────────┬─────────────┐
          ▼             ▼                     ▼             ▼
       session         file                  test      parameterized
      (per run)     (per file)            (per test)  (cartesian product)
          └─────────────┴──────────┬──────────┴─────────────┘
                                   ▼
                      injected into the test function
                                   │
                                   ▼
                        LIFO teardown, per scope
```

This package implements discovery, the scope cache, dependency injection, parameterization,
the public types, and the CLI internals. The published wrapper
([`packages/bun-test-utils`](../bun-test-utils)) re-exports it as the root entrypoint and
bundles the sibling capability packages
([`std`](../std), [`pbt`](../pbt), [`dom`](../dom), [`browser`](../browser),
[`vcr`](../vcr), [`snapshot`](../snapshot), [`bdd`](../bdd)) as subpath imports.

## Further reading

- Docs site: [getting started](https://archont561.github.io/bun-test-utils/guides/getting-started/),
  [scopes and teardown](https://archont561.github.io/bun-test-utils/guides/scopes-and-teardown/),
  [discovery and merging](https://archont561.github.io/bun-test-utils/guides/discovery-and-merging/),
  [parameterized fixtures](https://archont561.github.io/bun-test-utils/guides/parameterized-fixtures/),
  [API](https://archont561.github.io/bun-test-utils/reference/api/) and
  [CLI](https://archont561.github.io/bun-test-utils/reference/cli/) references
- Specs: [0001 fixture engine](../../.backlog/docs/specs/0001-fixture-engine.md),
  [0002 discovery and merge](../../.backlog/docs/specs/0002-discovery-and-merge.md),
  [0003 CLI init](../../.backlog/docs/specs/0003-cli-init.md),
  [0004 public API and types](../../.backlog/docs/specs/0004-public-api-and-types.md)
- Internal layout: sources in `src/`, focused tests in `tests/`

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.

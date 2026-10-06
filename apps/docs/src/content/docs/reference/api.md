---
title: API Reference
description: Public TypeScript API reference for bun-test-utils.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


## Public exports

The published package exposes only:

```ts
import { describe, expect, test } from "bun-test-utils";
```

Capability packs are internal. Do not import `bun-test-utils/std`,
`bun-test-utils/pbt`, `bun-test-utils/vcr`, or other subpaths; their fixtures and
runners are available through the root `test` object.

## `test(name, fn, options?)`

Defines a fixture-aware test. Requested fixtures are detected from the first
parameter's destructuring pattern and must exist in the imported `test.extend()`
chain or in the built-in root fixture set.

```ts
test("uses fixtures", async ({ tmpdir, env }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
});
```

### Test options

| Option | Type | Default | Behaviour |
| :-- | :-- | :-- | :-- |
| `fixtures` | `string[]` | auto-detected | Explicit fixture list, overriding auto-detection from the destructured parameter |
| `timeout` | `number` | Bun default | Per-test timeout in milliseconds, forwarded to `bun:test` |

## `test.extend(fixtures)`

Composes project fixtures and mocks explicitly:

```ts
import { test as base } from "bun-test-utils";

export const test = base.extend({
  db: {
    scope: "file",
    setup: async (use) => {
      const db = await createDatabase();
      await use(db);
      await db.close();
    },
  },
  clock: {
    setup: async (use) => {
      await use({ now: () => new Date(0) });
    },
  },
});
```

Fixture scopes are `"session"`, `"file"`, and `"test"` (default). Dependencies are resolved before the fixture that requests them, and teardown after `await use(value)` runs in strict LIFO order.

## `test.prop(title, arbitraryFactory, fn, options?)`

Runs a property test. The arbitrary factory receives the `fast-check` API; the
test callback receives fixtures first and generated values second.

```ts
test.prop(
  "encoding is reversible",
  (fc) => ({ text: fc.string(), key: fc.integer({ min: 1, max: 255 }) }),
  async ({ tmpdir }, { text, key }) => {
    tmpdir.write("value.txt", text);
    expect(decode(encode(tmpdir.read("value.txt"), key), key)).toBe(text);
  },
  { numRuns: 100 },
);
```

Every generated sample and shrink candidate gets fresh test-scoped fixtures;
session and file fixtures are shared across the property run.

## `test.scenario(title)` and `test.scenario.prop(title, arbitraryFactory)`

Builds one fixture-aware test from fluent `given`, `when`, and `then` steps.
Object results from `given` and `when` are merged into the next context; fixture
values are available alongside scenario state.

```ts
test.scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .when("the user is created", async ({ db, name }) => ({
    user: await db.users.create({ name }),
  }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBeDefined();
  });
```

## `describe` and `expect`

Re-exported directly from `bun:test` for convenience.

## Built-in fixture names

The root `test` includes these built-in fixtures:

- Standard: `tmpdir`, `env`, `stdio`
- DOM: `window`, `document`, `page`
- Browser/server: `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`
- VCR: `cassette`
- Snapshots: `snapshot`

## Environment variables

| Variable | Behaviour |
| :-- | :-- |
| `BUN_TEST_UTILS_DEBUG` | Emits opt-in diagnostics to stderr when set to `1` |
| `VCR_MODE` | Selects cassette mode: `record`, `replay`, or `passthrough` |
| `SNAPSHOT_MODE` | Selects snapshot mode: `match`, `update`, or `ci` |

There are no fixture discovery environment variables. The preload does not walk
your project tree, and `fixtures.ts` / `conftest.ts` are not special filenames.

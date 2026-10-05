# bun-fixture

**pytest-style scoped, injectable fixtures for `bun test`.**

```ts
import { test, expect } from "bun-fixture";

test("creates a user", async ({ db }) => {
  expect(await db.insert({ name: "ada" })).toMatchObject({ id: 1 });
});
```

`db` was never imported, constructed, or reset here. It was declared once, in a
`fixtures.ts` next to the tests that need it, and the engine built it, injected
it, and tore it down.

---

## Philosophy

**Setup is a dependency, not a prologue.** A test should name what it needs and
receive it. `beforeEach` chains describe *when* things happen; fixtures describe
*what a test depends on*, and let the runner work out the order.

**Teardown is the second half of setup.** Cleanup written far from the code that
allocated the resource rots. One function owns both halves, split by the moment
it hands the value over:

```ts
setup: async (use) => {
  const server = await startServer();
  await use(server);   // the test runs here
  await server.stop(); // …and this is guaranteed to follow
}
```

**Scope is a contract.** `session`, `file`, `test` say how long a value lives
and therefore who may share it. The engine enforces the implication: a
long-lived fixture may not depend on a short-lived one, because it would
outlive its own dependency. That is a registration error, not a mystery failure
on test 47.

**The directory tree is the configuration.** Fixtures declared in a directory
belong to the tests beneath it, and a nearer declaration wins over a farther
one. Nothing is registered, imported, or wired by hand — moving a test to
another folder changes what it can ask for, exactly as `conftest.py` does.

**Failures belong at registration.** Unknown names, dependency cycles, and
scope violations are detected while tests are being collected, with the
available fixtures listed in the message — before a single assertion runs.

**No magic, no globals.** `bun:test` is left untouched; `test` is an explicit
import, opt-in per file. A file that does not import it behaves exactly as it
did before.

**A thin wrapper, deliberately.** This exists because `bun test` has no fixture
API ([oven-sh/bun#8257](https://github.com/oven-sh/bun/issues/8257)). If Bun
ships one, the engine should become a compatibility shim and get out of the
way.

---

## The API

### Setup

```bash
bun add -d bun-fixture
bunx bun-fixture init     # adds the preload to bunfig.toml, scaffolds fixtures.ts
```

### Declaring fixtures

Any directory may hold a `fixtures.ts` (or `conftest.ts`). The default export
maps a name to a definition.

```ts
// fixtures.ts
export default {
  server: {
    scope: "session",
    setup: async (use) => {
      const s = await startServer();
      await use(s);
      await s.stop();
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
};
```

```ts
interface FixtureDef<T = any> {
  setup: (use: (value: T) => Promise<void>, ctx: FixtureContext) => void | Promise<void>;
  scope?: "session" | "file" | "test";   // default: "test"
  params?: T[];                          // multiplies the tests that use it
  deps?: string[];                       // explicit, when destructuring won't do
}
```

`await use(value)` suspends until the scope ends, so everything after it is
teardown. Not awaiting is allowed — the fixture then has none.

### Scopes

| Scope | Built | Destroyed |
|-------|-------|-----------|
| `"session"` | once per `bun test` run | after the run |
| `"file"` | once per test file | when the file is done |
| `"test"` | every test (**default**) | immediately after the test |

Teardown is **LIFO** — dependents before their dependencies.

### Using fixtures

```ts
import { test, expect, describe } from "bun-fixture";

test("the user can log in", async ({ user, server }) => {
  expect(await server.login(user)).toBe(true);
});
```

Fixtures are read from the destructured parameter. When that is not possible —
a wrapper, a minifier, no destructuring — name them:

```ts
test("explicit", async (ctx) => { ctx.db; }, { fixtures: ["db"], timeout: 10_000 });
```

Besides fixture values, the context carries `testFile` and `testName`.

### Directory hierarchy

```
fixtures.ts                 # server, db, user
tests/
  fixtures.ts               # overrides db, adds apiClient
  api/
    fixtures.ts             # adds fakeStripe
    checkout.test.ts        # sees: server, user, db(tests), apiClient, fakeStripe
```

Root → leaf, last wins. Siblings never see each other.

### Parameterization

```ts
mode:   { params: ["fast", "slow"], setup: async (use, { param }) => use(param) },
region: { params: ["eu", "us"],     setup: async (use, { param }) => use(param) },
```

```ts
test("round trips", async ({ mode, region }) => { /* … */ });
```

One `bun test` case per combination — the cartesian product, including any
parameterized fixture reached transitively:

```
✓ round trips [mode=fast, region=eu]
✓ round trips [mode=fast, region=us]
✓ round trips [mode=slow, region=eu]
✓ round trips [mode=slow, region=us]
```

### Errors you get instead of surprises

```
[bun-fixture] unknown fixture "reel" requested in tests/api.test.ts. Available: db, server, user
[bun-fixture] scope mismatch: "cache" (session) cannot depend on "tmp" (test) — a fixture
              may only use equally or longer-lived fixtures.
[bun-fixture] circular fixture dependency: a → b → a (tests/api.test.ts)
[bun-fixture] fixture "forgetful" finished without calling use(value)
```

### Exports

```ts
import { test, expect, describe, createTest } from "bun-fixture";
import type { FixtureDef, FixtureMap, FixtureContext, Scope, TestOptions } from "bun-fixture";
```

| Export | Purpose |
|--------|---------|
| `test(name, fn, opts?)` | fixture-aware test; finds its own file from the stack |
| `createTest(file?)` | `{ test, describe, expect }` bound to an explicit file — pass `import.meta.path` |
| `expect`, `describe` | re-exported from `bun:test`, unchanged |

Engine internals are exported for tooling and for testing fixture trees:
`discoverFixtures`, `registerFixtures`, `fixturesFor`, `resolveOrder`,
`paramCombos`, `destructuredKeys`, `teardownFile`, `teardownSession`.

### CLI

```bash
bunx bun-fixture init [--dir <path>] [--entry <preload path>] [--force]
```

Appends the preload entry to `[test].preload` in `bunfig.toml` (idempotent,
preserves the rest of the file) and scaffolds a root `fixtures.ts`.

### Environment

| Variable | Effect |
|----------|--------|
| `BUN_FIXTURE_ROOT` | discovery root (default: `process.cwd()`) |
| `BUN_FIXTURE_NO_AUTODISCOVER` | skip the startup walk; call `discoverFixtures()` yourself |

---

Limits, trade-offs, and what this deliberately does not do:
[.backlog/docs/caveats.md](../../.backlog/docs/caveats.md). Design rationale:
[.backlog/docs/adr](../../.backlog/docs/adr). Contributing: [the workspace
root](../../README.md).

MIT

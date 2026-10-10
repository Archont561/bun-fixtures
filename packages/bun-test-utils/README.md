# @archont561/bun-test-utils

A general-purpose test extension for the [Bun test runner](https://bun.sh/docs/test/overview). It gives `bun test` Playwright-style fixtures: typed, injectable values that you compose explicitly with `test.extend()`, scoped to a session, a file, or a single test, and torn down in strict reverse order. On the same runner, it adds behaviour-driven scenarios, property-based testing, snapshot testing, HTTP record/replay cassettes, and DOM and browser testing.

- **Documentation:** <https://archont561.github.io/bun-test-utils/>
- **Source and issues:** <https://github.com/Archont561/bun-test-utils>
- **Changelog and releases:** <https://github.com/Archont561/bun-test-utils/releases>

## Install

```bash
bun add -d @archont561/bun-test-utils
bunx test-utils init
```

`init` adds the package's preload to `bunfig.toml` (`[test].preload`). The preload only installs run-wide teardown hooks. It does not load fixtures. Fixtures come from the modules you import, as described below.

Requires Bun 1.1 or later.

## Quick start

Compose the fixtures your project needs in one module, then import the composed `test` into each test file.

```ts
// tests/test.ts
import { test as base } from "@archont561/bun-test-utils";

export const test = base.extend({
  database: {
    scope: "file",
    setup: async (use) => {
      const database = await createDatabase();
      await use(database);
      await database.close(); // runs after the last test in the file
    },
  },
  user: {
    setup: async (use, { database }) => {
      await use(await database.insertUser({ name: "Ada" }));
    },
  },
});
```

```ts
// tests/user.test.ts
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("finds the user", async ({ database, user }) => {
  expect(await database.find(user.id)).toMatchObject({ name: "Ada" });
});
```

Run the suite with `bun test`.

A fixture declares its dependencies by destructuring them in `setup`. The engine builds dependencies first and tears them down last. Everything after `await use(value)` is that fixture's teardown, and it runs even when the test fails.

## Fixture model

| Concept | What it means |
| :-- | :-- |
| Composition | `test.extend({ ... })` returns a new `test` that includes your fixtures. Only the imported chain contributes fixtures. Nothing is discovered from the file tree. |
| Scopes | `"session"` (once per run), `"file"` (once per test file), `"test"` (default, once per test). |
| Lifetimes | A fixture may depend only on fixtures of equal or longer lifetime. A violation is reported when the test is declared, before any assertion runs. |
| Teardown | Strict LIFO: a fixture's teardown finishes before the teardown of anything it depends on begins. |
| Overrides | Fixtures share one namespace. A later definition with the same name replaces the earlier one, including built-ins. |

## Built-in capabilities

Built-in capabilities are fixtures on the root `test` context, so you request them the same way as your own:

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("reads the environment", async ({ env, tmpdir }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
  expect(tmpdir.read("mode.txt")).toBe("test");
});
```

| Area | Fixtures | Notes |
| :-- | :-- | :-- |
| Standard | `tmpdir`, `env`, `stdio`, `clock`, `seed`, `networkGuard` | Isolated temporary directories, sandboxed environment variables, captured output, controlled time and randomness, and blocked outbound `fetch` unless allowed. |
| DOM | `window`, `document`, `page` | In-memory DOM via happy-dom. Requires `happy-dom`. |
| Web (either backend) | `webPage` | happy-dom by default. Set `BUN_TEST_UTILS_WEB_ENV=browser` to run the same test on a real Playwright page. |
| Browser | `browser`, `browserContext`, `browserPage`, `browserHttpMock` | Playwright Chromium, headless. Requires `playwright` and an installed browser. Experimental. |
| Server and HTTP | `testServer`, `serverUrl`, `httpMock` | An ephemeral `Bun.serve` server, and MSW-like fetch handlers. |
| Cassettes | `cassette` | Get or record callback results with `cassette(fn)`, use explicit record/replay controls, and record and replay HTTP traffic. |
| Snapshots | `snapshot` | Compare values and files against stored snapshots. |

### Property-based tests

`test.prop` runs a property over generated values with `fast-check`. Every sample gets its own test-scoped fixtures, built and torn down in isolation.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test.prop(
  "addition is commutative",
  (fc) => ({ a: fc.integer(), b: fc.integer() }),
  async (_fixtures, { a, b }) => {
    expect(a + b).toBe(b + a);
  },
  { numRuns: 100 },
);
```

Requires `bun add -d fast-check`.

### Scenarios

`test.scenario` builds one test from fluent `given`, `when`, and `then` steps. Return values from `given` and `when` are merged into the next step's context, and fixtures are available alongside them.

```ts
import { test } from "@archont561/bun-test-utils";

test
  .scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .when("the user is created", ({ name }) => ({ user: { id: 1, name } }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBeDefined();
  });
```

Requires `bun add -d @aboviq/bun-test-cucumber`. Scenarios are experimental.

### Snapshots

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("renders the widget", async ({ snapshot }) => {
  const widget = await snapshot(
    async () => render({ name: "widget", count: 3 }),
    "widget",
  );
  expect(widget.count).toBe(3);
});
```

Callable `snapshot(fn, name)` runs and awaits `fn` every time, matches its result under the required explicit name, and returns that same result. It is an assertion wrapper, not a cache: it never keys on the function body. If `fn` throws or rejects, its error propagates and no snapshot is written. Use `snapshot.match(value, name?)` and `snapshot.matchFile(path, name?)` unchanged for direct values and files.

The first run writes `__snapshots__/` next to the test file. Commit that directory, so a change to the snapshot shows up in review.

### HTTP mocks and cassettes

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("loads the user", async ({ httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  const user = await fetch("https://app.test/api/user").then((r) => r.json());
  expect(user).toEqual({ name: "Ada" });
});
```

`cassette(fn)` is the get-or-record callback form; explicit `cassette.record` and `cassette.replay` keep precise control. In local default `auto` mode, a missing callback source records with a visible warning and replaces its stale sidecar entry; CI, explicit replay, and serializer-version mismatches remain strict. Use `cassette.addSerializer(...)` for a test-specific callback value type, or register a reusable preload serializer once through the `/vcr` subpath. A test's HTTP traffic is recorded under `__cassettes__/` on its first run and replayed afterwards with no network access.

## Optional peers

Install a peer only if you use the capability that needs it. The core fixture engine works without any of them.

| Capability | Peer |
| :-- | :-- |
| `test.prop`, `test.scenario.prop` | `fast-check` |
| `test.scenario` | `@aboviq/bun-test-cucumber` |
| `window`, `document`, `page`, `webPage` (DOM backend) | `happy-dom` |
| `browser*`, `webPage` (browser backend) | `playwright`, plus the browser binaries: `bunx playwright install chromium` |

`fast-check` is also referenced by the published type declarations. With `skipLibCheck: false`, TypeScript needs it installed even if you only use non-property APIs. With `skipLibCheck: true`, ordinary imports typecheck without it.

## Shared helpers

Typed helpers live on four subpaths. They export definitions and types only, never runners or fixtures.

```ts
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";
import { givenStep, whenStep, thenStep } from "@archont561/bun-test-utils/bdd";
import { createSnapshotSerializer } from "@archont561/bun-test-utils/snap";
import {
  defineCallbackSerializer,
  registerCallbackSerializer,
  unregisterCallbackSerializer,
} from "@archont561/bun-test-utils/vcr";
```

- `/pbt`: `defineArbitraries` for reusable fast-check arbitrary records.
- `/bdd`: `givenStep`, `whenStep`, `thenStep` for reusable scenario steps.
- `/snap`: register and unregister global snapshot serializers, usually from a preload.
- `/vcr`: `defineCallbackSerializer` for reversible cassette value serializers, plus `registerCallbackSerializer` and identity-based `unregisterCallbackSerializer` for serializers shared process-wide (typically from a preload). Fixture-local `cassette.addSerializer` remains available and takes precedence over global registrations.

Global registrations remain until unregistered. `registerCallbackSerializer` returns the supplied serializer; `unregisterCallbackSerializer(serializer)` removes every registration of that exact object and returns whether it removed one or more.

For example, a Bun test preload can make one reversible type available to every
cassette fixture without repeating `cassette.addSerializer(...)`:

```ts
// test-serializers.ts, listed in bunfig.toml [test].preload
import {
  defineCallbackSerializer,
  registerCallbackSerializer,
} from "@archont561/bun-test-utils/vcr";

class Token {
  constructor(readonly value: string) {}
}

registerCallbackSerializer(
  defineCallbackSerializer<Token>({
    name: "token",
    version: 1,
    test: (value) => value instanceof Token,
    serialize: (token) => ({ value: token.value }),
    deserialize: (data) => new Token((data as { value: string }).value),
  }),
);
```

Fixture-local serializers still win over this project-wide default. See
[Recording HTTP cassettes](https://archont561.github.io/bun-test-utils/guides/recording-http-cassettes/)
for the versioning and cleanup rules.

## Stability and platforms

- **Stable, follows semantic versioning:** the fixture engine, the standard, DOM, snapshot, and property-testing capabilities, and the minimal cassette contract (callable `cassette(fn)`, explicit `record`/`replay`, fixture-local `addSerializer`, `/vcr` global serializer registration, and exact HTTP matching by uppercase method plus full URL).
- **Experimental, may change in minor versions:** the browser capability and BDD scenarios.
- **Not yet frozen:** the on-disk cassette and snapshot file formats, and the header-redaction helper.
- **Not in this release:** a cassette matcher DSL, configurable redaction, cassette migration tooling, database and filesystem-sandbox fixtures, and worker-scoped fixtures.
- **Platforms:** Linux and macOS. Windows support is planned.

The full stability and error-compatibility contract is in the [API reference](https://archont561.github.io/bun-test-utils/reference/api/).

## License

Licensed under either the [MIT License](https://github.com/Archont561/bun-test-utils/blob/main/LICENSE-MIT) or the [Apache License 2.0](https://github.com/Archont561/bun-test-utils/blob/main/LICENSE-APACHE), at your option.

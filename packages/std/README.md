# @bun-test-utils/std

> **Internal workspace.** Bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as the
> `bun-test-utils/std` subpath; never published on its own.

Zero-dependency fixtures for common test isolation: temporary directories, environment
variables, and stdio capture, each with automatic restoration on teardown.

```ts
import stdFixtures, { tmpdirFixture, envFixture, stdioFixture } from "bun-test-utils/std";
```

No third-party dependencies — nothing extra to install.

## Fixtures

| Fixture | Scope | Helper | What it does |
| --- | --- | --- | --- |
| `tmpdir` | test | `TmpDirHelper` | Unique scratch directory, recursively removed on teardown |
| `env` | test | `EnvHelper` | Snapshots `process.env` and restores it on teardown |
| `stdio` | test | `StdioHelper` | Captures stdout/stderr, restores the real streams on teardown |

### `tmpdir`

```ts
test("writes files", async ({ tmpdir }) => {
  tmpdir.write("notes/todo.txt", "buy milk");     // creates parents, returns the path
  expect(tmpdir.read("notes/todo.txt")).toBe("buy milk");
  expect(tmpdir.exists("notes")).toBe(true);
  tmpdir.path("..");                              // resolve relative to the scratch dir
  tmpdir.remove("notes/todo.txt");
  // tmpdir.dir is the absolute path of the scratch directory
});
```

### `env`

```ts
test("reads config from env", async ({ env }) => {
  env.set("APP_MODE", "test");
  env.delete("APP_SECRET");
  expect(env.get("APP_MODE")).toBe("test");
  const before = env.snapshot();                  // Record<string, string | undefined>
});
```

### `stdio`

```ts
test("logs on failure", async ({ stdio }) => {
  console.log("hello");
  console.error("oops");
  expect(stdio.stdout()).toContain("hello");
  expect(stdio.stderr()).toContain("oops");
  expect(stdio.output()).toContain("hello");      // combined
  stdio.clear();
});
```

## Composing

All three ship inside the default `stdFixtures` map — register or merge it into your
`fixtures.ts` like any other `FixtureMap`:

```ts
import stdFixtures from "bun-test-utils/std";

export default {
  ...stdFixtures,
  // …your own fixtures
};
```

## Further reading

- Spec: [0009 standard fixtures](../../.backlog/docs/specs/0009-standard-fixtures-std.md)
- Sources in `src/`, focused tests in `tests/` (one test file per source module)

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.

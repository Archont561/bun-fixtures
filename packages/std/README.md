# Standard fixtures (internal)

The standard fixtures (`tmpdir`, `env`, `stdio`) are internal workspace fixtures bundled into the public root `test` from `bun-test-utils`. There is no public `bun-test-utils/std` subpath.

```ts
import { expect, test } from "bun-test-utils";

test("writes isolated state and reads test configuration", async ({ tmpdir, env }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("notes/todo.txt", "buy milk");

  expect(env.get("APP_MODE")).toBe("test");
  expect(tmpdir.read("notes/todo.txt")).toBe("buy milk");
  expect(tmpdir.exists("notes")).toBe(true);
});
```

`tmpdir` is removed, `env` is restored, and `stdio` hands the real streams back during fixture teardown.

These fixtures are exercised in [`tests/`](./tests/) through this package's own `test.extend(...)` composition — injected by name, torn down by the engine. The teardown assertions live in the test *after* the one that uses the fixture, which is how a suite observes that the tmpdir was removed, the environment restored, and the real stream writers handed back.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

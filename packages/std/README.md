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

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

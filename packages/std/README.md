# Standard fixtures

`bun-test-utils/std` provides zero-dependency isolation for ordinary tests. The fixtures are available from the published package's `std` subpath.

## Temporary files and environment

```ts
import { expect, test } from "bun-test-utils/std";

test("writes isolated state and reads test configuration", async ({ tmpdir, env }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("notes/todo.txt", "buy milk");

  expect(env.get("APP_MODE")).toBe("test");
  expect(tmpdir.read("notes/todo.txt")).toBe("buy milk");
  expect(tmpdir.exists("notes")).toBe(true);
});
```

`tmpdir` is removed and `env` is restored after the test.

## Capturing output

```ts
import { expect, test } from "bun-test-utils/std";

test("captures application output", async ({ stdio }) => {
  console.log("started");
  console.error("warning");

  expect(stdio.stdout()).toContain("started");
  expect(stdio.stderr()).toContain("warning");
  expect(stdio.output()).toContain("started");
});
```

The public helpers are `tmpdir`, `env`, and `stdio`. They are test-scoped and restore process state during teardown.

See the [standard fixture guide](https://archont561.github.io/bun-test-utils/reference/plugins/#bun-test-utilsstd) and [`tests/`](./tests/) for more cases.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

# Standard fixtures (internal)

The standard fixtures (`tmpdir`, `env`, `stdio`, `clock`, `seed`, and `networkGuard`) are internal workspace fixtures bundled into the public root `test` from `@archont561/bun-test-utils`. There is no public `@archont561/bun-test-utils/std` subpath.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("runs with isolated deterministic state", async ({
  tmpdir,
  env,
  clock,
  seed,
  networkGuard,
}) => {
  env.set("APP_MODE", "test");
  tmpdir.write("notes/todo.txt", "buy milk");
  clock.freeze("2026-01-02T03:04:05Z");
  seed.set(42);
  networkGuard.allow("https://api.example.test/health");

  expect(env.get("APP_MODE")).toBe("test");
  expect(tmpdir.read("notes/todo.txt")).toBe("buy milk");
  expect(clock.now().toISOString()).toBe("2026-01-02T03:04:05.000Z");
  expect(Math.random()).toBeTypeOf("number"); // deterministic from seed 42
});
```

- `clock.freeze(value)` and `clock.set(value)` wrap `bun:test`'s `setSystemTime`; `clock.now()` reads the current instant.
- `seed` replaces `Math.random` with a deterministic per-test generator. Read `seed.value` to capture the generated replay seed or call `seed.set(value)` to replay it. A failing test includes `[bun-test-utils] seed: <value>` in its error.
- `networkGuard` blocks every unexpected `fetch` with a stable method-and-URL error. Add explicit passthrough entries with `networkGuard.allow(string | RegExp | predicate)` and inspect requests with `networkGuard.calls()`.

During fixture teardown, `tmpdir` is removed, `env` is restored, `stdio` hands the real streams back, the system clock and `Math.random` are restored, and the network guard removes its shared fetch interceptor.

These fixtures are exercised in [`tests/`](./tests/) through this package's own `test.extend(...)` composition — injected by name, torn down by the engine. Teardown assertions live in the test *after* the one using a fixture because the engine tears down after the test body returns.

Property tests in `tests/invariants.test.ts` pin `env` set/get/delete round-trips and `tmpdir` write/read identity over generated relative paths, plus the escape check for `..` and absolute paths.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

# @bun-test-utils/std

Private workspace. It provides the standard fixtures, bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md). Each one gives a test isolated state and restores it at teardown:

| Fixture | Provides |
| :-- | :-- |
| `tmpdir` | An isolated temporary directory with `write`, `read`, `exists`, `remove`, and `path`. Removed at teardown. |
| `env` | Sandboxed environment variables: `set`, `get`, `delete`, `snapshot`. Reverted at teardown. |
| `stdio` | Captured writes to `process.stdout` and `process.stderr`: `stdout()`, `stderr()`, `output()`, `clear()`. The real streams are restored at teardown. `console.*` is not captured. |
| `clock` | Controlled time: `freeze`, `set`, `now`. |
| `seed` | A deterministic `Math.random` sequence: `value`, `set`, `random`. `set` restarts the sequence from a given seed. |
| `networkGuard` | Blocks `fetch` unless allowed: `allow(...matchers)`, `calls()`. |

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("runs with isolated, deterministic state", async ({ tmpdir, env, clock, seed }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("notes/todo.txt", "buy milk");
  clock.freeze("2026-01-02T03:04:05Z");
  seed.set(42);

  expect(env.get("APP_MODE")).toBe("test");
  expect(tmpdir.read("notes/todo.txt")).toBe("buy milk");
  expect(clock.now().toISOString()).toBe("2026-01-02T03:04:05.000Z");
});
```

The fixture reference is in the [built-in fixtures](https://archont561.github.io/bun-test-utils/reference/plugins/) page, and the behaviour is specified in [spec 0009](../../.backlog/docs/specs/0009-standard-fixtures-std.md).

## Develop

```bash
cd packages/std
bun run test
bun run test:bdd
bun run typecheck
```

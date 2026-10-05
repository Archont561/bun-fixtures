# @bun-fixture/std

Standard zero-dependency built-in fixtures (`tmpdir`, `env`, `stdio`) for `bun-fixture`.

## Features

- **`tmpdir`**: Isolated temporary scratch directory per test, with helper methods (`write`, `read`, `exists`, `remove`, `path`) and automatic LIFO recursive cleanup.
- **`env`**: Environment variable sandboxing with `set`, `delete`, `get`, `snapshot`, guaranteeing full restoration on test teardown.
- **`stdio`**: Output capture for `process.stdout` and `process.stderr` without leaking into test output.

## Installation

```bash
bun add -d @bun-fixture/std
```

## Usage

In your `fixtures.ts`:

```ts
import stdFixtures from "@bun-fixture/std";

export default {
  ...stdFixtures,
};
```

In your test file:

```ts
import { test, expect } from "bun-fixture";

test("creates and verifies a temporary file", async ({ tmpdir, env, stdio }) => {
  env.set("APP_DIR", tmpdir.dir);
  tmpdir.write("config.json", JSON.stringify({ ok: true }));
  
  expect(tmpdir.exists("config.json")).toBe(true);
  expect(JSON.parse(tmpdir.read("config.json"))).toEqual({ ok: true });
});
```

MIT

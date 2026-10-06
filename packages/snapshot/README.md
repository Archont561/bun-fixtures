# Snapshot fixtures (internal)

The `snapshot` fixture is an internal workspace fixture bundled into the public root `test` from `bun-test-utils`. There is no public `bun-test-utils/snapshot` subpath.

```ts
import { expect, test } from "bun-test-utils";

test("records a stable value", async ({ snapshot }) => {
  snapshot.setMode("match");
  snapshot.match({ component: "card", count: 2 }, "card");
  expect(snapshot.mode).toBe("match");
});
```

Snapshots are scoped fixtures: setup, storage, and teardown stay in the test context rather than in globals.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

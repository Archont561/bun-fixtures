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

The snapshot fixture is exercised in [`tests/`](./tests/) through `test.extend(...)` composition, with `createTest(<path>)` binding the suite to a scratch test file so the `__snapshots__/` convention resolves into a temp directory. Because the fixture writes during teardown, every on-disk assertion lives in the test that follows its writer.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

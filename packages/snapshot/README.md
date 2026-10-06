# Snapshot fixtures

`bun-test-utils/snapshot` records values and files beside the test, with deterministic serialization and CI-safe modes.

## Snapshot a value

```ts
import { expect, test } from "bun-test-utils/snapshot";

test("matches a rendered model", async ({ snapshot }) => {
  snapshot.setMode("match");
  snapshot.match({ component: "card", count: 2 }, "card");
  expect(snapshot.mode).toBe("match");
});
```

Missing snapshots are recorded in normal `match` mode. Use `update` to accept changes and `ci` to fail instead of creating files.

## Snapshot a file with standard fixtures

```ts
import { expect, test } from "bun-test-utils";

test("matches generated markup", async ({ snapshot, tmpdir }) => {
  const file = tmpdir.write("report.html", "<h1>Report</h1>\n");
  snapshot.setMode("match");
  snapshot.matchFile(file, "report");
  expect(snapshot.path).toContain("__snapshots__");
});
```

Custom serializers run before built-ins, anonymous snapshots are numbered, and snapshot files live at `__snapshots__/<test-name>.snap.json`.

See the [snapshot guide](https://archont561.github.io/bun-test-utils/guides/snapshot-testing/) and [`tests/`](./tests/) for update, CI, file, serializer, and mismatch cases.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

# @bun-test-utils/snapshot

Private workspace. It provides the `snapshot` fixture, bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md). It compares values and files against stored snapshots:

- callable `snapshot(callback, name)` (run, await, match, and return), plus `snapshot.match(value, name?)` and `snapshot.matchFile(path, name?)`;
- three modes, selected with `SNAPSHOT_MODE` or `snapshot.setMode`: `match` (default), `update`, and `ci` (selected automatically when `CI` is set);
- fixture-local serializers, plus process-wide serializers registered through the helper-only `@archont561/bun-test-utils/snap` subpath;
- stable diagnostic codes for circular values (`SNAPSHOT_CIRCULAR_REFERENCE`) and failing serializers (`SNAPSHOT_SERIALIZER_FAILED`).

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("records a stable value", async ({ snapshot }) => {
  const card = await snapshot(
    async () => ({ component: "card", count: 2 }),
    "card",
  );
  expect(card.count).toBe(2);
});
```

The callable form runs its callback on every invocation, awaits it, matches the result under its required non-empty name, and returns the same result. It never caches or keys by callback source. A thrown or rejected callback error propagates without writing a snapshot. Direct `match` and `matchFile` retain their existing behavior.

Snapshots are written to `__snapshots__/<test name>.snap.json` next to the test file. Commit that directory.

The public guide is at [Snapshot testing](https://archont561.github.io/bun-test-utils/guides/snapshot-testing/). The behaviour is specified in [spec 0013](../../.backlog/docs/specs/0013-snapshot-testing.md).

## Develop

```bash
cd packages/snapshot
bun run test
bun run test:bdd
bun run typecheck
```

---
title: Snapshot Testing
description: Compare values and files against stored snapshots with bun-test-utils/snapshot.
---

`bun-test-utils/snapshot` serializes a value (or the contents of a file) and
compares it against a snapshot stored on disk, recording a new one the first
time a test runs.

## Installation

`snapshot` ships inside `bun-test-utils` — zero extra dependencies:

```bash
bun add -d bun-test-utils
```

Register the bundle in your `fixtures.ts`:

```ts
import snapshotFixtures from "bun-test-utils/snapshot";

export default {
  ...snapshotFixtures,
};
```

## Using the snapshot fixture

```ts
import { test, expect } from "bun-test-utils";

test("renders the widget", async ({ snapshot }) => {
  const widget = render({ name: "widget", count: 3 });
  snapshot.match(widget);
});
```

The first run writes `__snapshots__/renders-the-widget.snap.json` next to
the test file; every later run compares against it and throws a readable
diff on mismatch. Commit `__snapshots__/` — reviewing its diff *is* the
review of a behavioural change.

## Modes

Switch modes with `SNAPSHOT_MODE=match|update|ci`, or `snapshot.setMode(...)`
per test:

- **`match`** (default): records missing snapshots, fails on mismatch.
- **`update`**: accepts new values in bulk after an intentional change.
- **`ci`**: never records — a missing *or* mismatched snapshot fails the
  test. Selected automatically when `process.env.CI` is set.

```bash
SNAPSHOT_MODE=update bun test
```

## Multiple snapshots and custom serializers

```ts
test("captures three states", async ({ snapshot }) => {
  snapshot.match(initialState());
  snapshot.match(afterClick(), "after-click");
  snapshot.matchFile(reportPath, "report");
});
```

Unnamed calls are auto-numbered (`value`, `value 2`, ...); pass a `name` to
address one explicitly. Register a serializer for types the built-in
string / `Error` / sorted-key JSON handling doesn't cover:

```ts
snapshot.addSerializer((value) =>
  value instanceof Point ? `Point(${value.x}, ${value.y})` : undefined,
);
```

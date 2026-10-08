---
title: Snapshot Testing
description: Compare values and files against stored snapshots with the root snapshot fixture.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


The built-in `snapshot` fixture serializes a value (or the contents of a file) and
compares it against a snapshot stored on disk, recording a new one the first
time a test runs.

## Installation

`snapshot` is available on the root `test` context — zero extra dependencies:

```bash
bun add -d bun-test-utils
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

### Reusable global serializers

For serializers shared by every test, register them from a preload module:

```ts
// test-serializers.ts
import { createSnapshotSerializer } from "bun-test-utils/snap";

createSnapshotSerializer((value) =>
  value instanceof Date ? "<date>" : undefined,
);
```

```toml
[test]
preload = ["./test-serializers.ts"]
```

Global serializers are automatically used by every `snapshot` fixture in the
Bun process, including nested values inside objects and arrays. Fixture-local
serializers from `snapshot.addSerializer()` run first; within each group,
newer registrations run first. Global serializers run before the built-in
string / `Error` / sorted-key-JSON / `String()` fallbacks. A serializer must
return `undefined` for values it does not handle.

`registerSnapshotSerializer` and `createSnapshotSerializer` both return the
registered function. Keep that reference to unregister it when its owner ends:

```ts
import {
  createSnapshotSerializer,
  unregisterSnapshotSerializer,
  type Serializer,
} from "bun-test-utils/snap";

const redactSecrets: Serializer = (value) =>
  typeof value === "string" && value.startsWith("sk-")
    ? "<secret>"
    : undefined;

const registered = createSnapshotSerializer(redactSecrets);
// At the end of the suite or preload lifecycle:
unregisterSnapshotSerializer(registered);
```

Unregistering removes every registration of that exact function and returns
`true` if any were removed (`false` otherwise). `resetSnapshotSerializers()`
clears the process-wide registry while preserving the shared registry used by
the root entrypoint and `/snap` subpath. Use it at a controlled suite or watch
reload boundary before registering the current set again:

```ts
import {
  createSnapshotSerializer,
  resetSnapshotSerializers,
} from "bun-test-utils/snap";

resetSnapshotSerializers();
createSnapshotSerializer((value) =>
  value instanceof Date ? "<date>" : undefined,
);
```

Both operations affect every snapshot fixture in this Bun process. Do not reset
the registry between concurrently running tests; register preload-wide
serializers once, or unregister only the serializer owned by a suite.
```

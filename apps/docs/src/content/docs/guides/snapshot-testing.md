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
bun add -d @archont561/bun-test-utils
```

## Using the snapshot fixture

```ts
import { test, expect } from "@archont561/bun-test-utils";

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

## Reset a snapshot

To accept a new baseline for one test, delete its snapshot file and run the test again. `bunx test-utils cache clear --file <test file> --test "<name>"` does this, `--file <test file>` clears every test in the file, and `--all` clears every `__cassettes__/` and `__snapshots__/` directory under the nearest `package.json` project root (`--dry-run` previews without deleting; `--yes` skips interactive TTY prompts). `match` then records the new value, and `ci` refuses to create it. Review the diff of `__snapshots__/` before you commit the reset. See [Recording HTTP cassettes](/bun-test-utils/guides/recording-http-cassettes/#clear-a-recording) for the full command.

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
import { createSnapshotSerializer } from "@archont561/bun-test-utils/snap";

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
} from "@archont561/bun-test-utils/snap";

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
} from "@archont561/bun-test-utils/snap";

resetSnapshotSerializers();
createSnapshotSerializer((value) =>
  value instanceof Date ? "<date>" : undefined,
);
```

Both operations affect every snapshot fixture in this Bun process. Do not reset
the registry between concurrently running tests; register preload-wide
serializers once, or unregister only the serializer owned by a suite.

## Recursive values and diagnostics

Custom serializers run at the root and recursively for object properties and
array entries. At each value, fixture-local serializers take precedence over
global serializers; the newest serializer in each group runs first. The built-in
`Error` fallback is recursive too, so a nested error snapshots as
`Error: <message>` unless a custom serializer handles it first. Reusing the same
acyclic object in two places serializes it at both locations; only a reference
back to an object on the current recursion path is a cycle.

Cyclic values fail with an `Error` named `SnapshotSerializationError`, code
`SNAPSHOT_CIRCULAR_REFERENCE`, and details containing the snapshot name/path,
the value path (for example `$.user.items[0]`), and the path where the object was
first seen. If a custom serializer throws, snapshotting fails with code
`SNAPSHOT_SERIALIZER_FAILED`; the diagnostic identifies the snapshot and value
path, and the original thrown value is preserved as `cause`. These stable codes
and details make recursive failures actionable without silently replacing the
value with `[object Object]`.

---
title: Snapshot Testing
description: Compare values and files against stored snapshots with the snapshot fixture, custom serializers, and reviewable diffs.
---

The `snapshot` fixture serializes a value, or the contents of a file, and compares it against a snapshot stored next to the test. The first time a test runs, it records the snapshot. Later runs compare against it and fail with a readable diff when the value changes.

## Installation

`snapshot` is on the root `test` context, with no extra dependency:

```bash
bun add -d @archont561/bun-test-utils
```

## Use the fixture

```ts
import { test } from "@archont561/bun-test-utils";

test("renders the widget", async ({ snapshot }) => {
  const widget = render({ name: "widget", count: 3 });
  snapshot.match(widget);
});
```

The first run writes `__snapshots__/renders-the-widget.snap.json` next to the test file. Every later run compares against that file. Commit `__snapshots__/`: reviewing its diff is how you review a change in behaviour.

## Snapshot a callback result

For work that produces a value asynchronously, call the fixture itself. The
name is required and becomes the stored snapshot key:

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("loads a profile", async ({ snapshot }) => {
  const profile = await snapshot(
    async () => fetchProfile("ada"),
    "ada-profile",
  );

  expect(profile.id).toBe("ada");
});
```

`await snapshot(fn, name)` always runs and awaits `fn` once, then behaves like
`snapshot.match(result, name)` and returns the original result. It is not a
cache: it never reads the function body, captures, or identity, and calling it
again runs the callback again. Use a direct `snapshot.match(value, name?)` for
an already available value, including anonymous auto-numbered snapshots.

If `fn` throws or rejects, its original error propagates, `match` is not called,
and that invocation writes no snapshot. A successful callback can still report
the ordinary snapshot mismatch or serializer error after it returns.

## Modes

Select a mode with `SNAPSHOT_MODE`, or per test with `snapshot.setMode(...)`:

- **`match`** (default): records missing snapshots, and fails on a mismatch.
- **`update`**: accepts new values in bulk, after an intentional change.
- **`ci`**: never records. A missing snapshot or a mismatched one fails the test. Selected automatically when `CI` is set.

```bash
SNAPSHOT_MODE=update bun test
```

## Multiple snapshots and files

```ts
test("captures three states", async ({ snapshot }) => {
  snapshot.match(initialState());
  snapshot.match(afterClick(), "after-click");
  snapshot.matchFile(reportPath, "report");
});
```

Unnamed calls are numbered automatically: `value`, `value 2`, and so on. Pass a name to address one explicitly.

## Custom serializers

The built-in serializers handle strings, `Error` values, and objects with sorted keys. Register a serializer for other types. It returns a string for the values it handles, and `undefined` for everything else:

```ts
test("serializes points", async ({ snapshot }) => {
  snapshot.addSerializer((value) =>
    value instanceof Point ? `Point(${value.x}, ${value.y})` : undefined,
  );
  snapshot.match(new Point(1, 2));
});
```

Serializers registered on the fixture apply to that test. They run before the built-in serializers, and the most recent registration runs first.

## Global serializers

For a serializer that every test should use, register it once from a preload module with the `/snap` subpath:

```ts
// test-serializers.ts
import { createSnapshotSerializer } from "@archont561/bun-test-utils/snap";

createSnapshotSerializer((value) => (value instanceof Date ? "<date>" : undefined));
```

Add the module to `[test].preload` in `bunfig.toml`:

```toml
[test]
preload = ["./test-serializers.ts"]
```

Global serializers apply to every `snapshot` in the process, including values nested inside objects and arrays. Fixture-local serializers run first. Global serializers run before the built-in fallbacks.

`createSnapshotSerializer` and `registerSnapshotSerializer` return the function they register. Keep that reference to remove the serializer later:

```ts
import {
  createSnapshotSerializer,
  unregisterSnapshotSerializer,
  type Serializer,
} from "@archont561/bun-test-utils/snap";

const redactSecrets: Serializer = (value) =>
  typeof value === "string" && value.startsWith("sk-") ? "<secret>" : undefined;

const registered = createSnapshotSerializer(redactSecrets);
// later, when the owner is done with it:
unregisterSnapshotSerializer(registered);
```

`unregisterSnapshotSerializer` removes every registration of that exact function and returns `true` if any were removed. `resetSnapshotSerializers()` clears the global registry. Use it only at a controlled boundary, such as the start of a watch-mode reload, and register the serializers you need again afterwards. Both operations affect every snapshot in the process, so do not call them while tests run concurrently.

## Recursive values and diagnostics

Serializers run on the root value, and again on each object property and array entry. At each value, fixture-local serializers take precedence over global ones, and the newest serializer in each group runs first.

The built-in `Error` serializer is recursive too. A nested error snapshots as `Error: <message>`, unless a custom serializer handles it first. An object that appears in two places is serialized at both. Only a reference back to an object on the current path is treated as a cycle.

A cycle fails with an `Error` named `SnapshotSerializationError` and the code `SNAPSHOT_CIRCULAR_REFERENCE`. Its details give the snapshot name, the value path (for example `$.user.items[0]`), and the path where the object was first seen.

If a custom serializer throws, snapshotting fails with `SNAPSHOT_SERIALIZER_FAILED`. The diagnostic names the snapshot and value path, and the original error is preserved as `cause`.

## Reset a snapshot

To accept a new baseline for one test, clear its snapshot and run the test again. The next run records it:

```bash
bunx test-utils cache clear --file tests/widget.test.ts --test "renders the widget"
```

`--file <path>` without `--test` clears every test in the file, and `--all` clears every snapshot and cassette under the project root. `--dry-run` previews what would be deleted. Review the diff of `__snapshots__/` before you commit the reset. In `ci` mode the test fails until a reviewed snapshot is committed. See [Recording HTTP cassettes](/bun-test-utils/guides/recording-http-cassettes/#clear-a-recording) for the full command.

## Next steps

- [Recording HTTP cassettes](/bun-test-utils/guides/recording-http-cassettes/) for recording HTTP traffic and callback results.
- [API reference](/bun-test-utils/reference/api/) for the environment variables and error codes.

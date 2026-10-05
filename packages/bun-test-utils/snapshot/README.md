# @bun-test-utils/snapshot

Value and file snapshot-testing fixtures for `bun-test-utils`.

## Features

- **`snapshot`**: Serializes any value (or the contents of a file) and
  compares it against a stored snapshot, recording a new one on first run.
- **Automatic snapshot files**: comparisons are written to
  `__snapshots__/<test name>.snap.json` next to the test file — no explicit
  file bookkeeping.
- **Configurable modes**: `match` (default), `update`, `ci` (controlled via
  the API or the `SNAPSHOT_MODE` environment variable; `ci` is auto-selected
  when `process.env.CI` is set).
- **Multiple snapshots per test**: anonymous calls are auto-numbered
  (`value`, `value 2`, ...), or pass an explicit name.
- **Pluggable serializers**: register a custom serializer for types the
  built-in JSON/string/error handling doesn't cover (DOM nodes, binary
  buffers, responses recorded by `@bun-test-utils/vcr`, ...).
- **File snapshots**: `matchFile(path, name?)` snapshots a file's contents
  directly — handy together with `@bun-test-utils/std`'s `tmpdir` fixture.

## Installation

```bash
bun add -d @bun-test-utils/snapshot
```

## Usage

In your `fixtures.ts`:

```ts
import snapshotFixtures from "@bun-test-utils/snapshot";

export default {
  ...snapshotFixtures,
};
```

In your test file:

```ts
import { test, expect } from "bun-test-utils";

test("renders the widget", async ({ snapshot }) => {
  const widget = render({ name: "widget", count: 3 });
  snapshot.match(widget);
});
```

The first run records `__snapshots__/renders-the-widget.snap.json`; every
later run compares against it and fails with a readable diff on mismatch.

## Modes

- **`match`** (default outside CI): compares against the stored value. A
  missing entry is recorded instead of failing — the normal first-run
  workflow.
- **`update`**: (re)writes every snapshot touched during the test,
  regardless of what was stored before. Set `SNAPSHOT_MODE=update` to accept
  intentional changes in bulk, then review the diff of `__snapshots__/`
  before committing.
- **`ci`**: never creates a snapshot — a missing *or* mismatched entry fails
  the test, so a forgotten `SNAPSHOT_MODE=update` run can't slip through.
  Automatically selected when `process.env.CI` is set; override per test
  with `snapshot.setMode(...)`.

```ts
test("matches a stored value, failing loudly in CI", async ({ snapshot }) => {
  snapshot.match(buildReport());
});
```

```bash
SNAPSHOT_MODE=update bun test   # accept new values after an intentional change
```

## Snapshot files

The fixture follows a convention, so tests need no file bookkeeping:

- The snapshot file for a test lives at **`__snapshots__/<test name>.snap.json`**
  next to the test file (the helper exposes it as `snapshot.path`).
- Each call to `match()`/`matchFile()` within a test gets its own key:
  explicit via the `name` argument, or auto-numbered (`value`, `value 2`, ...)
  when omitted.
- Snapshots are meant to be committed — reviewing the diff of
  `__snapshots__/` *is* the code review for behavioural changes.

## Custom serializers

```ts
test("serializes a Point", async ({ snapshot }) => {
  snapshot.addSerializer((value) =>
    value instanceof Point ? `Point(${value.x}, ${value.y})` : undefined,
  );
  snapshot.match(new Point(1, 2));
});
```

Serializers run most-recently-registered first; return `undefined` to fall
through to the next one (built-in string / `Error` / sorted-key JSON /
`String()` serializers always run last).

## License

Dual-licensed under either of [Apache-2.0](./LICENSE-APACHE) or
[MIT](./LICENSE-MIT) at your option — SPDX `MIT OR Apache-2.0`.

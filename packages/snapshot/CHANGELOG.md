# @bun-test-utils/snapshot

## 0.1.0

Initial release: value and file snapshot-testing fixtures.

- `snapshot` fixture serializes any value (or the contents of a file via
  `matchFile`) and compares it against a stored snapshot, recording a new
  one on first run.
- Automatic snapshot paths: `__snapshots__/<test name>.snap.json` next to
  the test file, exposed as `snapshot.path`.
- `match` / `update` / `ci` modes, switchable through the API or the
  `SNAPSHOT_MODE` environment variable (`ci` auto-selected when
  `process.env.CI` is set) — `ci` mode fails instead of silently recording
  a missing or stale snapshot.
- Multiple snapshots per test via auto-numbered (`value`, `value 2`, ...) or
  explicitly named keys, and pluggable custom serializers for types the
  built-in string / `Error` / sorted-key JSON handling doesn't cover.

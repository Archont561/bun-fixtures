# @bun-test-utils/std

## 0.1.0

Initial release: zero-dependency standard fixtures with automatic LIFO restoration.

- `tmpdir` — unique scratch directory with `write` / `read` / `exists` / `path` / `remove` helpers; recursively wiped on teardown.
- `env` — sandboxes `process.env` (`set` / `delete` / `get` / `snapshot`) and restores it to its exact original state on teardown.
- `stdio` — captures `process.stdout.write` / `process.stderr.write` (`stdout()` / `stderr()` / `output()` / `clear()`) without leaking output, and hands the real streams back on teardown.
- `stdFixtures` bundle to spread into `fixtures.ts`; dogfooded by the `bun-test-utils` core suite.

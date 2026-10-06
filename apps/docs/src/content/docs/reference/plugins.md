---
title: Plugins & Ecosystem
description: Official companion packages for standard, DOM, browser, and property testing.
---

## Bundled Ecosystem Subpaths

Every subpath below ships inside the single `bun-test-utils` npm package — no extra
install for the pack itself. A few wrap a heavy third-party library declared as an
`optionalDependency` (`playwright`, `happy-dom`, `fast-check`); add it yourself with
`bun add -d <name>` if `bun install` skipped it on your platform.

### `bun-test-utils/std`

Zero-dependency standard fixtures — spread the bundle into your `test.ts`:

```ts
import { stdFixtures } from "bun-test-utils/std";

export default {
  ...stdFixtures,
};
```

- `tmpdir`: Isolated temporary directory with helper methods (`write`, `read`, `exists`, `remove`, `path`) and automatic recursive wipe.
- `env`: Environment variable sandboxing with exact restoration on teardown.
- `stdio`: Output capture for stdout and stderr, with the real streams handed back on teardown.

### `bun-test-utils/pbt`

Property-based testing integration — see the [Property-Based Testing guide](/bun-test-utils/guides/property-based-testing/):

- `test.prop(title, arbitraries, testFn, options)` combining `fast-check` with fixture injection.
- Requested fixtures auto-detect from `testFn`'s destructured first parameter (or `options.fixtures`).
- **Per-sample lifecycle**: session/file fixtures are shared across the run, while test-scoped fixtures are rebuilt and torn down (LIFO) for every generated sample — and every shrink step.

### `bun-test-utils/dom`

In-memory DOM simulation powered by `happy-dom`:

- `window`, `document`, and `page` fixtures with automatic global cleanup.

### `bun-test-utils/browser`

Headless browser & web server testing:

- `testServer` & `serverUrl`: Ephemeral `Bun.serve` server on random port 0 with automatic shutdown.
- `browser`, `browserPage`, `browserContext`: Session and test-scoped Playwright browser automation.

### `bun-test-utils/vcr`

HTTP Cassette recording and replaying — see the [Recording HTTP Cassettes guide](/bun-test-utils/guides/recording-http-cassettes/):

- `cassette`: Intercepts `globalThis.fetch` to record live HTTP requests to disk and replay them offline.
- **Automatic cassette files**: `__cassettes__/<test name>.json` next to the test file — auto-saved on teardown in record mode, auto-loaded at setup in replay mode, exposed as `cassette.path`.
- `record` / `replay` / `passthrough` modes via API or the `VCR_MODE` environment variable, with sensitive headers redacted by default.

### `bun-test-utils/snapshot`

Value and file snapshot testing — see the [Snapshot Testing guide](/bun-test-utils/guides/snapshot-testing/):

- `snapshot`: Serializes a value (or a file's contents via `matchFile`) and compares it against a stored snapshot, recording a new one on first run.
- **Automatic snapshot files**: `__snapshots__/<test name>.snap.json` next to the test file, exposed as `snapshot.path`; multiple snapshots per test are auto-numbered or explicitly named.
- `match` / `update` / `ci` modes via API or the `SNAPSHOT_MODE` environment variable (`ci` auto-selected in CI), plus pluggable custom serializers.

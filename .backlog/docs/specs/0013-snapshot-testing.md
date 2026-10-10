# 0013 — Snapshot Testing Fixture

- **Status:** implemented
- **Implementation:** `packages/snapshot/` or `@bun-fixture/snapshot`
- **Tests:** `packages/snapshot/tests/`

## Problem

`bun:test` ships `expect().toMatchSnapshot()`, but it only compares a single
serialized value per `expect()` call against Bun's own `__snapshots__/*.snap`
format, with no hook for custom serialization (DOM nodes, binary buffers,
HTTP responses recorded by `@bun-fixture/vcr`) and no CI-specific mode that
fails loudly instead of silently recording a forgotten snapshot. Tests also
often want to snapshot the *contents of a file* a fixture produced (e.g. a
report written into a `@bun-fixture/std` `tmpdir`), which has no direct
built-in equivalent.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `snapshot` fixture MUST serialize an arbitrary value and compare it against a stored snapshot, via `match(value, name?)`. |
| R2 | `snapshot` fixture MUST support snapshotting file contents directly via `matchFile(path, name?)`. |
| R3 | A missing snapshot MUST be recorded automatically in `"match"` mode (default outside CI) and MUST fail in `"ci"` mode. |
| R4 | Snapshot files MUST live at `__snapshots__/<test name>.snap.json` next to the test file, with no explicit bookkeeping required; the resolved path MUST be exposed as `snapshot.path`. |
| R5 | Multiple snapshots within one test MUST be addressable: auto-numbered (`value`, `value 2`, ...) when unnamed, or by an explicit `name`. |
| R6 | Mode MUST be switchable via the `SNAPSHOT_MODE` environment variable (`match` \| `update` \| `ci`) or `setMode()`, and MUST default to `"ci"` when `process.env.CI` is set and `SNAPSHOT_MODE` is unset. |
| R7 | Custom serializers MUST be pluggable via `addSerializer()`, running before the built-in string / `Error` / sorted-key-JSON / `String()` fallbacks. |
| R8 | A mismatch in `"match"`/`"ci"` mode MUST throw an error that includes both the stored and received values. |
| R9 | Global serializers MUST be removable by exact function identity (`unregisterSnapshotSerializer`, returning whether anything was removed) or cleared process-wide (`resetSnapshotSerializers`). Reset MUST mutate the shared registry in place so independently bundled root and `/snap` entrypoints observe the same lifecycle. |
| R10 | Custom serializers MUST run recursively for object properties and array elements. Fixture-local serializers run before global serializers; within each group, newest registrations run first. The built-in `Error` fallback MUST also apply recursively. |
| R11 | Serialization MUST detect a circular reference on the active recursion path and throw a stable diagnostic with code `SNAPSHOT_CIRCULAR_REFERENCE`, snapshot name/path, value path, and first-seen path. Repeated references that are not cycles MUST serialize normally. |
| R12 | A custom serializer exception MUST be wrapped in a stable diagnostic with code `SNAPSHOT_SERIALIZER_FAILED`, snapshot name/path, value path, and the original thrown value as `cause`. |
| R13 | `bunx test-utils cache clear` (spec 0012, R12) MUST delete the `__snapshots__/<slug>.snap.json` file of each selected test. No new snapshot mode is added. After a clear, `match` MUST record new baselines, and `ci` MUST still refuse to create them, as defined in [ADR 0036](../adr/0036-auto-cassette-mode-and-cache-clearing.md). |
| R14 | `snapshot` MUST be callable as `snapshot(callback, name)`, as defined in [ADR 0041](../adr/0041-callable-snapshot-wrapper.md). It MUST require a non-empty explicit `name`; run and await `callback` exactly once; call `match` with the resolved result and that name; and resolve to the original result. It MUST NOT cache, serialize for return, inspect, hash, or key on callback identity/source/body/captures. A callback throw or rejection MUST propagate unchanged, MUST NOT call `match`, and MUST NOT write a snapshot. `match(value, name?)` and `matchFile(path, name?)` retain their existing behavior. |

## Verification

- Tests verifying first-run recording, then a passing replay against the stored snapshot.
- Tests verifying a mismatch throws a descriptive error, and that `"update"` mode overwrites instead.
- Tests verifying `"ci"` mode refuses to create a missing snapshot.
- Tests verifying auto-numbered keys for multiple anonymous `match()` calls in one test.
- Tests verifying a registered custom serializer is used ahead of the built-ins.
- Tests verifying public global serializer unregister/reset controls share state across the root and `/snap` bundles and prevent leaks into later snapshots.
- Tests verifying nested object/array precedence, recursive `Error` handling, non-cyclic shared references, cyclic-value diagnostics, and serializer-failure cause/context.
- Tests verifying `matchFile()` against a file on disk, including the not-found error path.
- Tests verifying callable snapshots await and return the original callback result, use their explicit name, run the same callback on every call without a body/source key, reject missing names before execution, and propagate callback errors without writes (`packages/snapshot/tests/snapshot.test.ts`), with root and packed-consumer coverage.
- Installed-consumer boundary (ADR 0024): `packages/bun-test-utils/e2e/snap-serializer.test.ts`
  packs the publishable tarball, installs it into a scratch project, preloads a module
  registering a global serializer via the public `@archont561/bun-test-utils/snap` subpath, and verifies
  the generated `__snapshots__/<test>.snap.json` — including nested values and match-mode replay
  against the stored file. The registry rerun of this flow is task_005 criterion 5.

## Proposed API design — assertion first, fixture for control

Snapshot testing should be primarily an assertion concern and should compose with
all test styles:

```ts
expect(render()).toMatchSnapshot();
expect(render()).toMatchSnapshot("empty-cart");
```

The snapshot fixture remains available for explicit control:

```ts
test("renders an empty cart", async ({ snapshot }) => {
  snapshot.match(renderEmptyCart(), "empty-cart");
  snapshot.addSerializer(domSerializer);
});
```

The fixture MUST continue to support `match`, `matchFile`, serializers, mode,
and the resolved path. The preferred user-facing split is:

- `expect(value).toMatchSnapshot(name?)` for ordinary assertions;
- `snapshot.match(value, name?)` for custom serialization and fixture-driven
  workflows;
- `snapshot.matchFile(path, name?)` for generated files;
- `snapshot.setMode("update")` for explicit update control.

Snapshot identity should be stable and independent of a test-name slug whenever
possible. An explicit snapshot name is preferred for scenario and property
regressions:

```ts
.then("the rendered cart matches", ({ output, expect }) => {
  expect(output).toMatchSnapshot("cart-empty");
});
```

Property-based tests MUST NOT create an unbounded snapshot per generated case.
They should assert invariants directly, or snapshot a deliberately selected
counterexample/replay. Snapshot failures SHOULD include a structured diff,
the snapshot path, the logical snapshot name, and the update command.

Snapshots are regression artifacts, not substitutes for ordinary assertions:
use them for stable serialized output, CLI output, rendered markup, and files;
prefer focused assertions for volatile fields and business rules.

## 2026-10-10 API revision — callable snapshot assertions

Alongside direct `match`, the test-scoped fixture is callable for work that
produces a value:

```ts
test("loads a profile", async ({ snapshot }) => {
  const profile = await snapshot(() => api.profiles.get("ada"), "ada-profile");
  expect(profile.id).toBe("ada");
});
```

The explicit name is the stored key. The callback runs on every invocation;
there is no cache and no callback-body, source, or capture key. The wrapper is
equivalent to awaiting the callback, calling `snapshot.match(result, name)`,
and returning `result`. If the callback fails, its original error propagates
before matching or writing. Direct `match(value, name?)` keeps anonymous
auto-numbered snapshots for cases where a value is already available.

# 0041 — Callable snapshot wrapper with explicit names

- **Status:** accepted
- **Date:** 2026-10-10

## Context

The `snapshot` fixture currently exposes assertion-style methods:
`match(value, name?)` and `matchFile(path, name?)`. A common test shape first
performs asynchronous work, then snapshots the result, while still needing that
result for focused assertions:

```ts
const response = await request();
snapshot.match(response, "response");
expect(response.status).toBe(200);
```

The cassette fixture has a callable convenience form, but its semantics are a
cache and its identity is callback source. Snapshotting has deliberately
different semantics: it is an assertion and persistence mechanism keyed by a
logical snapshot name. Copying cassette's lookup or local-refresh policy would
make execution depend on recorded state and give function formatting an
incorrect role in snapshot identity.

## Decision

1. **Make the existing helper callable.** `SnapshotHelper` additionally has
   this public signature:

   ```ts
   snapshot<T>(callback: () => T | Promise<T>, name: string): Promise<T>
   ```

   Its existing object members — `match`, `matchFile`, `addSerializer`, mode
   controls, and `path` — remain available without behavioral changes.

2. **Run once, await once, match, then return.** A callable invocation calls
   `callback` exactly once, awaits its resolved value, passes that same value to
   `snapshot.match(value, name)`, and resolves to the original value. It does
   not cache, clone, serialize for return, or otherwise change the callback's
   value. Normal snapshot matching, update, serializer, and teardown behavior
   applies exactly as though the caller wrote `snapshot.match(await callback(),
   name)`.

3. **Require an explicit non-empty name.** The callable form always requires a
   non-empty string name. The type signature makes it required for TypeScript
   callers; the runtime rejects a missing or empty name before executing the
   callback. The name is passed directly to `match`, so it is the stored
   snapshot key and does not consume or derive an auto-numbered `value` key.
   Direct `snapshot.match(value)` continues to support its existing anonymous
   auto-numbering.

4. **No function identity.** The callable does not inspect, stringify, hash,
   cache, or key on the callback's body, object identity, captures, or module
   state. Repeating `await snapshot(callback, "result")` runs the callback each
   time; repeated calls match the same explicitly named snapshot as ordinary
   `match` calls do.

5. **Error boundary.** If the callback throws or rejects, the callable rejects
   with that original error, does not call `match`, and causes no snapshot write
   for that invocation. Snapshot errors from `match` propagate normally after a
   successful callback. The wrapper adds no fallback, retry, or error-swallowing
   behavior.

## Consequences

**Good**

- Tests get a concise async assertion form while preserving the produced value
  for ordinary assertions.
- Explicit names make persisted keys reviewable and prevent callback source
  text from becoming accidental snapshot identity.
- Callback failure remains side-effect-free with respect to snapshots.
- The implementation is intentionally a small composition of existing
  `match`, so serializers, mode semantics, and file layout stay singular.

**Bad**

- Every callable use must supply a meaningful name, even in a test with only
  one snapshot.
- The wrapper may be mistaken for a cache because cassette is callable too;
  documentation and tests must make the run-every-time distinction prominent.
- A successfully run callback can still be followed by a snapshot mismatch,
  just as explicit `match` can throw after value production.

## Alternatives considered

- **Use the callback source or identity as the key.** Rejected. Snapshot keys
  are logical review artifacts, and source/capture changes would make an
  unstable and misleading identity.
- **Reuse cassette get-or-record semantics.** Rejected. A snapshot assertion
  must always run the current callback; snapshot storage is not a result cache.
- **Allow an omitted callable name and auto-number it.** Rejected. The
  convenience form needs an explicit, stable intent, while plain `match`
  remains the concise option for anonymous snapshots.
- **Add a separate `snapshot.matchCallback` method.** Rejected. Callable
  fixture ergonomics match the requested API and retain all existing attached
  methods.
- **Catch callback errors and snapshot them.** Rejected. It would alter error
  semantics and could write a file for work that did not produce a value.

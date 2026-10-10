# 0039 — Callable cassette get-or-record wrapper with visible local refreshes

- **Status:** accepted
- **Date:** 2026-10-10
- **Supersedes:** ADR 0036 decision 4 only for a callback-source miss made through `cassette(fn)` in local `auto` mode. Its HTTP and direct-method rules remain in force.

## Context

The cassette fixture already exposes deliberately explicit callback operations:

```ts
await cassette.record(loadUser);
await cassette.replay(loadUser);
```

`record` always runs an unrecorded callback object (ADR 0027), while `replay`
returns a stored result without invoking the callback. ADR 0035 persists callback
results in a sidecar keyed by exact function source and deliberately drops stale
sidecar entries on the next recording run.

That is safe and precise, but it is repetitive for the common get-or-record case.
The requested shape is `await cassette(loadUser)`: callable like a wrapper while
retaining the existing object methods (`record`, `replay`, `addSerializer`,
`mode`, `setMode`, `path`, `entries`, `save`, `load`, and `redactHeader`).

The simple wrapper conflicts with ADR 0036 decision 4. That decision says an
`auto` cache miss fails with an exact cache-clear command rather than silently
re-recording or appending a new episode. That remains the correct rule for HTTP
requests and for an explicit `cassette.replay(callback)`, but a callable whose
purpose is explicitly *get or record* needs a narrowly defined refresh path.

The decision must also settle two sources of ambiguity:

- serializer envelopes name an exact `(name, version)`, so a registration at a
  different version cannot decode an earlier result;
- function source does not reveal captured variables, imported helper bodies, or
  other state read by the function. ADR 0027 records that limitation already.

## Decision

### 1. Public callable shape

`CassetteHelper` is callable in addition to its existing object surface:

```ts
const user = await cassette(() => api.users.get("user-1"));

cassette.addSerializer(userSerializer);
const cached = await cassette(loadUser);
```

The callback has the same `() => T | Promise<T>` signature as `record` and
`replay`, and the callable always returns `Promise<T>`. It uses the same
registry, codec, sidecar, serializer precedence, source identity, and teardown
as those methods. It does not introduce a second cache or an HTTP matcher.

`record(callback)` and `replay(callback)` keep their exact existing semantics.
In particular, this decision does **not** change ADR 0027 rule 3: `record` always
runs an unrecorded object and never reads a persisted result.

### 2. Mode dispatch

The callable dispatches from the cassette's selected mode as follows:

| Selected mode | `cassette(callback)` behaviour |
|---|---|
| `record` | Call `record(callback)`. This deliberately refreshes the callback recording and writes this run's sidecar at teardown. |
| `replay` | Call `replay(callback)` only. A miss, ambiguity, corrupt store, or serializer error propagates; the callback does not run. |
| `passthrough` | Invoke and await the callback, but do not register, encode, or persist its result. |
| local `auto`, resolved to `record` because no cassette exists | Call `record(callback)`. |
| local `auto`, resolved to `replay` because a cassette exists | Try `replay(callback)`. On the one safe miss described below, call `record(callback)` instead. |

A caller that uses `cassette.setMode("record")`, `setMode("replay")`, or
`setMode("passthrough")` has selected that explicit behaviour. In particular,
`setMode("replay")` is strict and must not opt into the local `auto` fallback.
Calling `setMode("auto")` re-resolves the normal auto policy for the current
cassette path.

### 3. Narrow `auto` miss refresh and the ADR 0036 exception

Only a `CALLBACK_NOT_RECORDED` result from the callable's initial `replay` is a
safe local-`auto` miss. When `CI` is **not** set, the callable then records the
callback, and teardown rewrites the sidecar with this run's recordings. The
old source entry is consequently pruned under ADR 0035 D1/D2.1; it is neither
appended to nor retained beside the new entry.

The refresh is never silent. **After a successful fallback record**, the wrapper
emits one `console.warn` line beginning
`[bun-test-utils/vcr] cassette(fn) re-recorded callback`. The line includes the
callback source label and the sidecar path. A failed encode/serialization writes
nothing and emits no refresh warning.

When `CI` is set, the same `CALLBACK_NOT_RECORDED` miss is an error: the wrapper
does not run the callback, does not write the sidecar, and propagates the replay
error. A missing cassette in `auto` still fails before the test body under ADR
0036 decision 2.

This **supersedes ADR 0036 decision 4 only for the local-`auto`, callable
callback-source miss described above**. ADR 0036 remains unchanged for:

- an HTTP request missing from an existing cassette: it fails with
  `CASSETTE_MISMATCH` and the exact `cache clear` command;
- `cassette.replay(callback)`: it fails with `CALLBACK_NOT_RECORDED`;
- explicit `replay` mode and all CI callback misses.

The wrapper is an explicit opt-in API. Its visible warning plus the sidecar diff
is the reviewable evidence for the re-record; it does not turn ordinary HTTP
`auto` mode into an append-on-miss policy.

### 4. Serializer versions are always strict

A missing exact serializer registration — including a registration with the
same name and a different version — remains a hard
`CALLBACK_SERIALIZER_NOT_FOUND` error in **every** mode. It is not treated as an
`auto` miss and is never automatically re-recorded, locally or in CI.

A serializer version describes the persisted wire format. Re-recording it
implicitly could turn a decoder incompatibility into an unnoticed fixture
update. A user who intentionally changed that format must register the prior
serializer to replay it, or run with explicit `VCR_MODE=record` and review the
sidecar replacement. Serializer failures, invalid sidecars, and ambiguous
factory evidence remain hard errors for the same reason.

### 5. Identity limit and no version argument

The callable uses the exact full `Function.prototype.toString()` source text
already defined by ADRs 0027 and 0035. It takes **no explicit version/key
argument in this release**. That keeps the requested form small and avoids
inventing a second identity scheme beside `record` and `replay`.

Consequently, it cannot see captured values, module-level state, environment
values, or changes in imported helper implementations when its own source text
is unchanged. A source hit returns the recorded value even if one of those
inputs changed. A factory source with ambiguity evidence still refuses rather
than guessing. Users need an explicit `VCR_MODE=record` refresh or cache clear
when they know these hidden inputs changed. Explicit keys or versions remain a
separate API/design decision, not an overloaded second argument to this wrapper.

## Consequences

**Good**

- The common callback cache workflow is one awaitable expression without
  sacrificing the explicit `record`/`replay` controls.
- A changed callback body can refresh locally in `auto` mode, and task 095's
  sidecar replacement rule means the following replay sees the new result.
- HTTP caches retain ADR 0036's fail-loudly policy; no request reaches the
  network or appends a response because a callback wrapper was added.
- CI and serializer migrations remain conservative. A build cannot quietly
  accept a changed callback body or codec version.
- A warning, sidecar rewrite, and source label make each local auto refresh
  observable in terminal output and reviewable in version control.

**Bad**

- Local `auto` runs can execute a callback after a source edit, so callers must
  not use the wrapper for work that is unsafe to refresh locally.
- `console.warn` adds deliberate output on a fallback refresh.
- Source identity retains ADR 0027's captured-state blind spot. The wrapper
  improves ergonomics, not callback identity.
- Users changing a serializer format must make an explicit recording choice;
  local auto will not repair it for them.

## Alternatives considered

- **Keep ADR 0036 unchanged and make the callable a thin `replay` alias.**
  Rejected. It would not be a get-or-record wrapper and would add little over
  the existing explicit method.
- **Let every replay error re-record in local auto.** Rejected. It would hide
  corrupt stores, factory ambiguity, serializer failures, and schema changes.
- **Make serializer version mismatch an `auto` miss but fail in CI.** Rejected.
  A local run would silently migrate a persisted wire format, which is riskier
  than a source edit and hard to audit reliably.
- **Append the refreshed callback beside older sidecar entries.** Rejected by
  ADR 0035 D1/D2.1: only this run's recordings survive, so stale source entries
  are pruned.
- **Add `cassette(callback, version)` now.** Rejected. It conflates user-level
  versioning with source identity and needs a dedicated explicit-key design.
- **Log only in debug mode.** Rejected. The exception to ADR 0036 must be
  visible by default so a fallback record is never silent.

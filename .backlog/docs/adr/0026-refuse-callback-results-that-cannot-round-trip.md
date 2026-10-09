# 0026 — Refuse callback results that JSON cannot round-trip

- **Status:** accepted, amended by 0034
- **Date:** 2026-10-09

> Amended by [ADR-0034](./0034-cassette-callback-serializers.md): values a
> built-in or user-registered serializer claims now round-trip through
> record→replay instead of being refused. The refusal with
> `CALLBACK_NOT_SERIALIZABLE` survives as the fallback for values no
> serializer claims, and points 2–8 stand; point 1's "every other value is
> refused" now reads "every other value no serializer claims is refused".

## Context

`cassette.record(callback)` stores the callback's result as JSON, and `cassette.replay(callback)` returns `JSON.parse` of that text. A value JSON does not represent exactly therefore comes back changed, and nothing warns. Measured on the built package for task_065 (2026-10-08):

- `Map`, `Set`, and `Error` replay as `{}`;
- `Date` replays as a string, and `BigInt` as the string `"123n"`;
- `NaN` and `Infinity` replay as `null`;
- a class instance replays as a plain object;
- a circular structure throws a raw `TypeError` with no code and no `[bun-test-utils/vcr]` prefix.

The same mechanism also drops nested `undefined`, function, and symbol-keyed values; turns `-0` into `0` and sparse-array holes into `null`; and turns `RegExp` and typed arrays into `{}` or index-keyed objects.

The first `record` call returns the live value, so the corruption appears only on replay. It also stays inside the test that recorded it: callback results are held in memory per test, and `save()` writes only HTTP entries. A later test that replays the same callback gets `CALLBACK_NOT_RECORDED`.

Spec 0012 R4 puts `record(callback)` and `replay(callback)` on the stable `0.1.x` surface and promises "the recorded serializable result". A `Map` is serializable in the ordinary sense, so the surface promises a value it cannot keep.

Two questions are involved. Supporting these values, with encoders and an on-disk format, is task_050's design: an extension point and a public contract. The smaller question comes first: what happens to a value that cannot round-trip. Spec 0012 R2 says the on-disk schema is not yet a stable public format, so nothing forces the larger answer into `0.1.0`.

## Decision

**`record` refuses a callback result that JSON cannot round-trip exactly. It does not store a corrupted copy, and `0.1.x` does not support these values.**

1. **Plain data is the only accepted shape.** A result is plain data when it is:
   - `null`, a boolean, or a string;
   - a finite number other than `-0`;
   - an array with no holes and no properties besides its indices;
   - an object whose prototype is `Object.prototype` or `null`, and whose own properties are all enumerable string keys.

   Every other value is refused, including `undefined`, functions, and symbols nested inside plain data. A top-level `undefined` is still accepted and stored as `"__undefined__"`, as before.

2. **A refusal is a `CassetteError` with code `CALLBACK_NOT_SERIALIZABLE`.** The message carries the `[bun-test-utils/vcr]` prefix, names the value and its path (for example `$.user.tags[2]`), and states the fix. `details` carries `path` and `valueType`. Nothing is registered, so `replay` reports `CALLBACK_NOT_RECORDED` and cannot return the rejected value.

3. **Cycles use the same code.** A cycle is detected during the walk and refused where it closes; `details` also carries the path where the object was first seen. A `TypeError` that `JSON.stringify` still throws is wrapped with the same code, the prefix, and the original error as `cause`.

4. **The check runs on the first call.** The callback runs first, because its result is unknown until it does, and the result is checked before anything is stored.

5. **A top-level function or symbol uses the same code.** It was `INVALID_API_USAGE`, so every refusal from `record` now has one code.

6. **Repeated references that are not cycles are plain data.** They serialize as copies, as spec 0013 R11 already requires for snapshots. The shared identity is not kept after replay.

7. **Compatibility.** The on-disk schema does not change (spec 0012 R2). `CALLBACK_NOT_SERIALIZABLE` is added to the public `BunTestUtilsErrorCode` union, which is additive and compatible under ADR 0018. `CassetteError` accepts an optional `cause`.

8. **Generators emit only canonical JSON.** `fc.jsonValue()` can emit `-0`, which JSON cannot represent, so the two property suites normalize generated values with `JSON.parse(JSON.stringify(value))`. This applies the same rule the refusal enforces, at generation time.

## Consequences

**Good**

- `replay` can no longer return a value that differs from what the callback returned.
- A refusal names the path and the fix, so the failure is actionable at the call site.
- One rule covers every shape, so a new shape is refused by default instead of being corrupted.

**Bad**

- A callback that returns a `Map`, `Set`, `Error`, `Date`, `BigInt`, class instance, or `-0` now throws at `record`, where it used to pass. The fix is to convert inside the callback: `Object.fromEntries(map)`, `date.toISOString()`, `String(big)`, or `0` for `-0`.
- The check walks the result once before storing it. Callback results are small in the intended use (API responses under test), so the cost is accepted.
- `CALLBACK_NOT_SERIALIZABLE` becomes part of the public error surface.

**Not covered.** Callback identity keys on source text, so two closures created by one factory can share a registry entry. That defect is separate (task_067) and needs its own decision.

## Alternatives considered

- **Support these values now**, with encoders for `Date`, `Map`, `Set`, and `BigInt`. Deferred to task_050: an encoding is an extension point and an on-disk format.
- **Record and warn.** Rejected: a warning is easy to miss, and the corrupted value is still stored and replayed.
- **Reuse `INVALID_API_USAGE`.** Rejected: that code describes misuse of the API. The refusal is a property of the value, and `CassetteError` already scopes cassette failures.
- **Treat `-0` as equal to `0`.** Rejected: bun:test distinguishes them (`expect(-0).toEqual(0)` fails), so a replayed `-0` is a real change.

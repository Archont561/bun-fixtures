# 0027 — Identify callbacks by object, then by source text

- **Status:** accepted
- **Date:** 2026-10-09

## Context

`cassette.record(callback)` and `cassette.replay(callback)` find a registry entry from the callback's identity. That identity must be derived without running the callback, because replay returns the recorded result without executing it (spec 0012 R4).

Today the identity is `fnv1a(Function.prototype.toString(callback))` plus the source length. Two closures from one factory have the same source text, so they share one entry. Reproduced on 2026-10-09 against the current code:

```ts
const makeLoader = (id: string) => () => ({ id });
await cassette.record(makeLoader("a")); // { id: "a" }
await cassette.record(makeLoader("b")); // { id: "a" }; the second body never runs
await cassette.replay(makeLoader("c")); // { id: "a" }; no warning
```

Two constraints bound the design:

- A function does not expose its captured variables. `id` above cannot be read or hashed without running the callback, and replay must not run it.
- A test often records a callback and later replays new code written the same way, for example `record(() => api.users.get("u1"))` followed by `replay(() => api.users.get("u1"))`. An identity made only of the object would break that pattern.

The registry lives in memory for one test and is not persisted (ADR 0026), so this decision concerns that one registry only.

## Decision

**A callback the test has recorded is identified by its object. A callback the test has not recorded is matched by its source text, and only when that match is unambiguous.**

1. **Object identity.** Each callback object recorded in a test gets its own registry entry, keyed by the object in a `WeakMap`. `record` returns that entry's result without running the callback again, and `replay` returns it. Any call order works.

2. **Source text for an unrecorded object.** An object the test has not recorded is matched by its exact source text against the recordings made from that text.
   - No recording matches: `replay` throws `CALLBACK_NOT_RECORDED`, as before.
   - Every matching recording holds the same result: `replay` returns that result.
   - The matching recordings hold different results: `replay` throws `CALLBACK_AMBIGUOUS` and does not run the callback. It does not guess.

3. **`record` runs every object it has not recorded.** A source match never short-circuits `record`. Two closures from one factory each run and each keep their own result.

4. **One recording per object.** If `record` is called again on an object before its first call settles, the first recording to finish is kept, and every call returns that result. Without this, one object could hold two recordings that disagree, and rule 2 would refuse it.

5. **Diagnostics.** Messages and `details.key` keep the `fnv1a` hash and length as a readable label. Lookups use the full source text, so a hash collision cannot merge two entries.

6. **Known limit: no explicit keys yet.** For an unrecorded closure whose source text matches recordings that all agree, `replay` returns the agreed result even if the closure's captured values differ. A new closure from a factory cannot be told apart from the same code written again. Two fixes exist: replay the recorded object, or add an explicit key. An explicit key extends the stable surface in spec 0012 R4, so it needs its own decision and is deferred.

7. **Compatibility.** `CALLBACK_AMBIGUOUS` joins the public `BunTestUtilsErrorCode` union. The change is additive under ADR 0018. The on-disk schema does not change (spec 0012 R2).

## Consequences

**Good**

- Two closures from one factory each record and replay their own result, in any order, when the test holds the objects.
- A fresh closure is never silently given a result that a recording with the same source text contradicts. It is refused, with the code and the remedy.
- The inline record-then-replay pattern keeps working.

**Bad**

- An unrecorded closure whose source text matches only agreeing recordings still gets the agreed result, even with different captured values. This is the silent residual. A test that needs distinct values must replay the recorded object.
- `record` of a closure whose source text matches an earlier recording now runs the closure. Before, it returned the earlier result without running. This change is visible to callers.

## Alternatives considered

- **Keep source text as the identity.** Rejected: it returns another closure's result without any warning. This is the defect.
- **Object identity only.** Fixes the factory collision, but breaks the inline record-then-replay pattern, which replays a new closure with the same code.
- **Ordinal per source text** (the n-th closure with source S matches the n-th recording). Rejected: replaying in another order silently returns the wrong result.
- **Call-site identity** (the stack location of the `record` call). Rejected: one loop or helper calls `record` from one place with many closures, and stack locations depend on the engine.
- **Refuse every second recording with the same source text.** Rejected: it refuses the factory and helper patterns that object identity already serves.
- **Hash the captured values.** Not possible. Captured values are not readable from a function, and reading them would require running it or using engine internals.
- **Explicit keys on `record` and `replay`.** The most robust option, and the one the task card names. Deferred: it changes the stable callback surface and needs its own decision.

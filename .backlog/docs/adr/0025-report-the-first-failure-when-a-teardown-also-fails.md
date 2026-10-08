# 0025 — Report the first failure when a teardown also fails

- **Status:** accepted
- **Date:** 2026-10-08

## Context

`makeTest` (`packages/core/src/plugin.ts`) builds the fixture graph and runs
`await fn(ctx)` in one `try`, with `await unwind(testStack)` in a `finally`. A
throw from a `finally` block replaces the error already in flight, so an error
raised while tearing down hides the error that started the failure.
`ctx.iterate` has the same shape — one `try`, one `finally` — so every PBT
sample and every shrink step behaves the same way. `unwind` itself collects
every teardown error into `errors`, throws `errors[0]`, and drops the rest with
no trace.

Three probes, run outside the repository while fixing task_059, pinned what a
user actually sees:

- a body throwing `body assertion failed`, with a fixture whose teardown throws
  `first teardown failed` → the run reports only `first teardown failed`;
- a second fixture's setup throwing `second setup failed`, masked the same way
  by an earlier fixture's failing teardown;
- a property throwing `property violated for 6`, under a teardown that throws
  on failed samples → the run reports `teardown invariant broken`.

`openFixtures` already takes the opposite view. Since task_059 (PR #36) it
unwinds whatever it built and rethrows the setup error, dropping the teardown
errors on purpose. So the two paths disagree about which error wins, and
neither shows both.

A teardown failure is usually a *consequence*: the fixture never finished
setting up, or the body left it in a state its teardown did not expect. Users
debug from the first error a run prints, so today they are handed the symptom
and the cause is gone. But dropping the teardown error instead — what
`openFixtures` does — is also wrong: that is the only evidence cleanup is
broken, and it disappears silently.

## Decision

**The error that started the failure is the one thrown. Every other error
raised while unwinding is attached to it as `suppressed`.**

1. **First failure wins on three paths.** A test body or a fixture setup on the
   regular path, `ctx.iterate` (each PBT sample and each shrink step), and
   `openFixtures` all keep the error that started the failure and attach the
   rest.

2. **`suppressed` is an enumerable own property on the thrown error.** Each
   losing teardown error is attached as `suppressed: Error[]`, in the order
   thrown, keeping the original objects — no copying, no wrapping, and no
   change to any message, name, class, or `code`. If `suppressed` already
   exists on the target, the new errors are appended to it; it is never
   overwritten, so an error can carry errors from more than one unwind. If the
   *thrown* value is not an object, nothing is attached: a thrown string or
   `undefined` has nowhere to put a list, and inventing a wrapper would change
   what the user catches. A non-object teardown error is still *collected* as an
   element of `suppressed` — only the target must be an object. This case is
   recorded here because it is the one gap in the record. **No diagnostic code
   is added, and errors are never wrapped in `AggregateError`.**

3. **`unwind` attaches every error it does not throw.** It still throws
   `errors[0]`, so a run with nothing in flight that hits a failing teardown
   still fails with it — now with the other teardown errors attached.
   `close()`, `teardownFile`, and `teardownSession` therefore throw the same
   error as before, plus `suppressed`. The session-exit warning is silent by
   default, so it carries the suppressed messages too; otherwise the evidence
   from a failing session teardown vanishes with no trace at all.

4. **A passing body or sample whose teardown throws still fails** with that
   teardown error. Nothing else went wrong, so there is nothing to prefer.

5. **`openFixtures` attaches its cleanup errors to the setup error instead of
   dropping them.** This reverses the deliberate drop merged in PR #36
   (task_059). The setup error still wins — that is what the PR #36 change was
   for — but the teardown failure is now reported rather than discarded. The
   reversal is recorded here rather than silently reverted.

6. **`suppressed` is additive and new.** No existing error shape changes, so
   the compatibility contract in ADR 0018 is untouched. Spec 0004's four
   contractual messages are about *diagnostic* failures — unknown fixture,
   circular dependency, a fixture that never called `use(value)`, and a blocked
   fetch — and none of them originates in a teardown, so that section gains
   nothing. `BunTestUtilsErrorCode` gains no member and `packages/core/src/
   errors.ts` gains no class: teardown errors are user-thrown, never ours.

## Consequences

**Good**

- A user debugging a double failure sees the root cause first — the body
  assertion, the setup error, or the violated property — instead of a teardown
  message that is usually a symptom of it.
- The teardown failure is no longer lost. It lands on `suppressed`, in the order
  thrown, as the original object with its own stack.
- Bun 1.4.2 prints an enumerable `suppressed` property when it reports an
  *async* test failure, so the regular path and the PBT path show both errors
  with no reporting work from us. A raw Bun test that throws *synchronously*
  gets no such printing — that is Bun's behaviour, not ours, and the property
  is still there for a user's own reporter to read.
- In practice this covers every bun-test-utils path: `makeTest` always wraps the
  body in `async body()`, so even a user's synchronous callback fails
  asynchronously as far as Bun is concerned, and its `suppressed` is printed
  too.
- One rule in one place: `unwind` and its reporting variant sit next to each
  other, and all three paths share them.

**Bad**

- The four contractual messages keep their wording exactly, but *which* one a
  user sees in a double failure can change: a scenario that used to end with the
  teardown message now ends with the body or setup one. Anything asserting on
  the message of a test that also has a failing teardown has to look at
  `suppressed` for the rest.
- `suppressed` is a new property on errors we did not create, and it is
  enumerable by design — that is what makes Bun print it. Code that enumerates
  a caught error's own keys, such as serializers, snapshot diffs, and
  structured loggers, sees one more key. Appending rather than overwriting keeps
  that to a single well-named property.
- A thrown non-object still loses its teardown errors. That is deliberate, and
  it is the one case where the record is incomplete.

## Alternatives considered

- **Let the teardown error win** — the behaviour today. Rejected: it reports the
  symptom and hides the cause, which is the defect this ADR exists to fix.
- **Wrap everything in `AggregateError`.** Rejected: it changes the class and
  the message of every failure a user catches, breaking the compatibility
  contract in ADR 0018 and every `toThrow("…")` assertion in the wild.
- **Keep the two paths different** — the setup error wins in `openFixtures`, the
  teardown error wins in `makeTest`. Rejected: two answers to the same
  question, with the difference invisible from a user's side. This is exactly
  the inconsistency task_063 was filed to remove.
- **Report the losing errors through the diagnostics route**
  (`reportDiagnostic` / `configureDiagnostics`, task_028). Rejected:
  diagnostics are opt-in, so a default run would still lose the teardown error.
- **Print the suppressed errors ourselves.** Rejected: it duplicates what Bun
  already does for async failures, and it would make our output differ from
  Bun's for the same error.

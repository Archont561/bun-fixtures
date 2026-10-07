# 0020 — Remove parameterized fixtures; `test.prop` covers the axis

- **Status:** accepted
- **Date:** 2026-10-07

## Context

The engine has carried `params` since M1: a fixture definition can list a static
array of values, and every test that (transitively) requests it is expanded at
registration into one case per value — the cartesian product when several
parameterized fixtures meet — with the current value exposed as `ctx.param` and
encoded in the case name (`"renders [browser=chromium, viewport=mobile]"`).

`test.prop` arrived later (spec 0010) and covers the same ground — varying one
test over values — with generation, shrinking, a replayable seed, and per-sample
fixture lifecycles through `ctx.iterate`.

ADR 0018 froze the whole fixture engine — parameterization included — as
**stable** for `0.1.0`, on the assumption that `0.1.0` would ship it. Nothing has
been published (`npm view bun-test-utils` is 404, `git tag -l` is empty), so this
is the only moment the surface can shrink without a major-version obligation.

## Decision

Remove parameterized fixtures from the engine:

- `FixtureDef.params` and the `ctx.param` metadata field are gone;
- `paramCombos` and the `[key=value]` case-name suffixes are gone — a case is
  registered under exactly the name it was given; and
- a `params` key on a fixture definition is ignored like any other unknown key,
  with no deprecation warning or runtime error. No consumer outside this
  repository has ever used it.

Parameterized unit tests are expressed with `test.prop` and `fc.constantFrom`
(or any other arbitrary). When a test author wants *guaranteed enumeration* of a
tiny static axis rather than a sample, an ordinary loop in the test body is the
tool.

ADR 0018's stability tiers otherwise stand: the engine remains stable, and the
stable engine no longer includes parameterization. Spec 0001 loses R8–R10,
spec 0010's R5 loses the fixture-parameter clause, and spec 0015's property cell
no longer names `paramCombos`.

## Consequences

**Good**

- One mechanism for "run this test over several values". The engine shrinks: no
  cartesian expansion at registration, no combo map threaded through
  instantiation, no per-param instance keying, no case-name format to keep
  stable.
- The optional `fast-check` peer — already the documented home of data-driven
  variation — becomes the single dependency question, instead of two mechanisms
  with different semantics for the same problem.

**Bad**

- Varying a test now requires the `fast-check` peer; a consumer who wants a
  zero-dependency matrix must write the loop themselves.
- `fc.constantFrom` draws with replacement, so a property over a small axis may
  not exercise every value in a single run. Old `params` gave exhaustive
  enumeration for free; the loop is the replacement when that guarantee matters.
- Pre-0.1.0 material (this repository's own history, early docs snapshots)
  references a removed feature. The migration note lives in the rewritten guide.

## Alternatives considered

- **Deprecate in `0.1.0` and remove later:** rejected. Deprecation implies an
  installed base; there is none, and the removal cost only grows once there is.
- **Keep `params` and `test.prop` side by side:** rejected — two mechanisms for
  one need, with different case identity, failure output, and dependency
  requirements, and every future engine change would have to consider both.
- **Make `params` a thin wrapper over `test.prop`:** rejected. It would give a
  stable engine feature a hard dependency on an optional peer, would not restore
  exhaustive enumeration (`constantFrom` samples), and would keep the
  registration-time expansion surface it was supposed to remove.

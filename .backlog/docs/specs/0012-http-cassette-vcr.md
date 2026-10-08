# 0012 — HTTP Cassette / VCR Testing Fixture

- **Status:** implemented
- **Implementation:** `packages/vcr/`
- **Tests:** `packages/vcr/tests/`, `packages/bun-test-utils/tests/conformance/capabilities.test.ts`
- **Compatibility:** [ADR 0018](../adr/0018-release-compatibility-contract.md)

## Problem

Integration tests hitting 3rd-party HTTP APIs (Stripe, GitHub, OpenAI) are slow, flaky, subject to rate limits, and fail in offline or air-gapped CI environments.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `cassette` fixture MUST intercept global `fetch` during test execution. |
| R2 | In **record mode** (`VCR_MODE=record`), HTTP requests and responses MUST be serialized under the `__cassettes__/` convention. The on-disk schema is not yet a stable public format. |
| R3 | In **replay mode** (`VCR_MODE=replay`), the stable matcher MUST compare the uppercase method and full URL exactly and MUST fulfill a match without network traffic. |
| R4 | The stable callback surface MUST consist of `record(callback)` and `replay(callback)`; replay MUST return the recorded serializable result without executing the callback. |
| R5 | Original `globalThis.fetch` MUST be restored upon fixture teardown. |
| R6 | Matcher DSLs, configurable redaction, and cassette migration tooling MUST remain explicitly deferred from the stable `0.1.x` contract. |
| R7 | `record(callback)` MUST refuse a callback result that is not plain data, as defined in [ADR 0026](../adr/0026-refuse-callback-results-that-cannot-round-trip.md). The refusal MUST be a `CassetteError` with code `CALLBACK_NOT_SERIALIZABLE`, the `[bun-test-utils/vcr]` prefix, and the offending path, and MUST register nothing. A circular structure MUST be refused with the same code. |
| R8 | A callback object that the test has recorded MUST be identified by that object. A callback object the test has not recorded MUST be matched by its exact source text only when every recording with that text holds the same result; otherwise `replay` MUST refuse with `CALLBACK_AMBIGUOUS` and MUST NOT run the callback. `record(callback)` MUST run any callback object it has not recorded, as defined in [ADR 0027](../adr/0027-identify-callbacks-by-object-then-source.md). |

## Verification

- Tests verifying record then replay sequence against an ephemeral Bun HTTP server.
- Tests verifying that unmatched requests in replay mode throw informative mismatch errors.
- Tests verifying that each callback result JSON cannot round-trip is refused with `CALLBACK_NOT_SERIALIZABLE`, and that replay then reports `CALLBACK_NOT_RECORDED` (`packages/vcr/tests/cassette.test.ts`).
- Tests verifying that two closures from one factory each run and record their own result, that each replays its own result in any order, and that a fresh closure whose recordings disagree is refused with `CALLBACK_AMBIGUOUS` without running (`packages/vcr/tests/cassette.test.ts`).

## 2026-10-06 API revision — explicit callback registry

The cassette is exposed as a test-scoped fixture, not as `test.cassette` and not
as a third test kind:

```ts
const test = base.extend(cassetteFixtures);

test("loads a user", async ({ api, cassette }) => {
  const user = await cassette.replay(() => api.users.get("user-1"));
  expect(user.id).toBe("user-1");
});
```

The public helper has only the two cassette-specific operations:

```ts
interface Cassette {
  record<T>(callback: () => T | Promise<T>): Promise<T>;
  replay<T>(callback: () => T | Promise<T>): Promise<T>;
}
```

For intercepted HTTP traffic, replay uses one stable matching rule only: both
the uppercase method and full URL must be equal. Header/body matching,
regular-expression or predicate DSLs, configurable redaction, and on-disk
migration tooling are not part of the stable surface.

A direct API call is live and does not need a `live()` wrapper:

```ts
const health = await api.health.check();
```

`record(callback)` executes the callback, resolves its callback identity, stores
the serialized output in the cassette registry, and returns that output.
`replay(callback)` resolves the same identity, returns the stored output, and
MUST NOT execute the live callback. Replay must find the output before executing
the callback, so the lookup never uses the output. How a callback resolves to a
registry entry is defined in the 2026-10-09 section below and in ADR 0027.

The same fixture is available in normal tests, `test.prop`,
`test.scenario`, and `test.scenario.prop`. Property tests should normally use
`replay`; recording an unbounded generated input space is not a supported default.

The implementation MUST restore any interception and close the cassette at test
teardown, including when a callback throws.

## 2026-10-09 — refuse results JSON cannot round-trip

`record(callback)` refuses a result that JSON cannot represent exactly, instead of
storing a corrupted copy (R7). A result is accepted only when it is plain data:
`null`, booleans, strings, finite numbers other than `-0`, arrays without holes or
extra properties, and objects whose prototype is `Object.prototype` or `null` and
whose own properties are all enumerable string keys. `Date`, `BigInt`, `Map`, `Set`,
`Error`, `RegExp`, typed arrays, class instances, `NaN`, `Infinity`, `-0`, cycles,
and nested `undefined`, functions, or symbols are refused. A top-level function or
symbol uses the same code, and a top-level `undefined` is still accepted.

The check runs on the first `record` call, after the callback runs and before anything
is stored, so `replay` reports `CALLBACK_NOT_RECORDED` and never returns a rejected
value. The on-disk schema does not change. Supporting these values is deferred to
task_050. The decision and its alternatives are in
[ADR 0026](../adr/0026-refuse-callback-results-that-cannot-round-trip.md).

## 2026-10-09 — identify callbacks by object, then by source

A callback is identified by its object once the test has recorded it. Only an
unrecorded callback is matched by its exact source text (R8), and only when every
recording with that text holds the same result. `record(callback)` runs any
callback object it has not recorded, even when its source text matches a
recording. A source match with disagreeing recordings is refused with
`CALLBACK_AMBIGUOUS`, and the callback does not run. Two closures from one factory
therefore keep their own results. A fresh closure whose source text matches
agreeing recordings still returns the agreed result, because captured values
cannot be read without running the callback. Explicit callback keys are deferred.
The decision and its alternatives are in
[ADR 0027](../adr/0027-identify-callbacks-by-object-then-source.md).

## Implementation status

The callback registry is implemented on `CassetteHelper`: a recorded callback object
is identified by that object, and an unrecorded one matches its source text only when
every recording with that text agrees (R8). `record()` runs any callback object it has
not recorded, serializes and stores one result, and refuses a result that is not plain
data (R7). `replay()` returns the stored result without invoking the callback, and
refuses a disagreeing source match with `CALLBACK_AMBIGUOUS`. HTTP replay compares the
uppercase method and full URL exactly. Coverage lives in the VCR unit suite and the
public root `cassette` fixture conformance suite.

The implementation still contains provisional storage and redaction helpers used by
workspace tests. They are deliberately outside the stable release contract and MUST NOT
be presented as compatibility guarantees.

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

## Verification

- Tests verifying record then replay sequence against an ephemeral Bun HTTP server.
- Tests verifying that unmatched requests in replay mode throw informative mismatch errors.
- Tests verifying that each callback result JSON cannot round-trip is refused with `CALLBACK_NOT_SERIALIZABLE`, and that replay then reports `CALLBACK_NOT_RECORDED` (`packages/vcr/tests/cassette.test.ts`).

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

`record(callback)` executes the callback, hashes its stable callback identity,
stores the callback output in the cassette registry, and returns that output.
`replay(callback)` resolves the same registry entry, returns the stored output,
and MUST NOT execute the live callback. The output is serialized and integrity-
hashed in the registry entry, but output hashes are not used as the lookup key
because replay must find the output before executing the callback.

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

## Implementation status

The callback registry is implemented on `CassetteHelper`: callback source identity is
hashed without executing the callback, `record()` serializes and stores one result, and
`replay()` returns that result without invoking the callback, and `record()` refuses a result that is not plain data (R7). HTTP replay compares the
uppercase method and full URL exactly. Coverage lives in the VCR unit suite and the
public root `cassette` fixture conformance suite.

The implementation still contains provisional storage and redaction helpers used by
workspace tests. They are deliberately outside the stable release contract and MUST NOT
be presented as compatibility guarantees.

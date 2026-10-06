# 0012 — HTTP Cassette / VCR Testing Fixture

- **Status:** implemented
- **Implementation:** `packages/vcr/` or `@bun-fixture/vcr`
- **Tests:** `packages/vcr/tests/`

## Problem

Integration tests hitting 3rd-party HTTP APIs (Stripe, GitHub, OpenAI) are slow, flaky, subject to rate limits, and fail in offline or air-gapped CI environments.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `cassette` fixture MUST intercept global `fetch` during test execution. |
| R2 | In **record mode** (`VCR_MODE=record`), HTTP requests and responses MUST be serialized to JSON/HAR files under `__cassettes__/`. |
| R3 | In **replay mode** (`VCR_MODE=replay`), requests matching method, URL, and headers MUST be fulfilled from disk without network traffic. |
| R4 | Header redaction (e.g. `Authorization`, `Cookie`) MUST be supported to prevent leaking secrets into committed cassette files. |
| R5 | Original `globalThis.fetch` MUST be restored upon fixture teardown. |

## Verification

- Tests verifying record then replay sequence against an ephemeral Bun HTTP server.
- Tests verifying that unmatched requests in replay mode throw informative mismatch errors.

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

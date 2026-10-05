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

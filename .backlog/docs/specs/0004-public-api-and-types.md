# 0004 — Public API and types

- **Status:** implemented/revised
- **Milestone:** M4
- **Implementation:** `packages/bun-test-utils/src/plugin.ts`, `packages/core/src/plugin.ts`, `packages/core/src/types.ts`
- **Tests:** `packages/core/tests/{plugin,error-messages}.test.ts`, `packages/std/tests/network-guard.test.ts`, `packages/bun-test-utils/tests/conformance/*.test.ts`, `bun run typecheck`
- **Compatibility:** [ADR 0018](../adr/0018-release-compatibility-contract.md)

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `import { test, expect, describe } from "bun-test-utils"` MUST work with no global monkey-patching. |
| R2 | The published root package MUST NOT export implementation helpers, type-helper values, capability subpaths, or default objects. |
| R3 | The root `test` MUST expose built-in fixture context for std, DOM, browser, VCR, and snapshot capabilities. |
| R4 | Property and BDD-style APIs MUST live on `test.*`: `test.prop`, `test.scenario`, and `test.scenario.prop`. |
| R5 | `test.extend(fixtures)` MUST remain the only public composition hook for user fixtures and mocks. |
| R6 | Fixture metadata (`testFile`, `testName`, `param`, `scope`, `iterate`) MUST be injectable internally but MUST NOT be treated as user fixtures. |
| R7 | The internal core package MAY export engine helpers for private workspaces; those helpers MUST NOT be re-exported from the public root package. |
| R8 | The package MUST typecheck under `strict` with no `any` leaking into public signatures other than dynamic fixture values. |
| R9 | The root fixture context MUST use one flat namespace containing exactly `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`, `window`, `document`, `page`, `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`, `cassette`, and `snapshot`. |
| R10 | Fixture composition MUST be last-definition-wins: a consumer `test.extend()` definition overrides a built-in key, and a later extension overrides an earlier one. Dependencies MUST resolve the winning definition by key. |
| R11 | The exact human-readable templates for unknown fixtures, circular dependencies, a fixture finishing without `use(value)`, and a fetch blocked by `networkGuard` MUST remain contractual; other diagnostic wording MAY change while machine-readable codes and meaning remain compatible. |

## Design

The core engine still owns explicit composition, fixture ordering, teardown, stack detection, and scenario execution. The wrapper assembles internal fixture maps once and exports a single user-facing API.

`use` is typed `(value: T) => Promise<void>` rather than `=> void`: a `void` return makes `await use(v)` meaningless and teardown impossible. Awaiting remains optional.

Stack-trace detection compares frames against both `import.meta.path` and its `realpathSync`, because a linked package reports a different path in the stack than in `import.meta`.

### Fixture-key collisions

All built-ins and consumer fixtures share one namespace. `test.extend()` is an
explicit override operation, not a duplicate-key error: the most recent
extension wins. A built-in fixture that depends on an overridden key receives
the consumer's winning value.

### Contractual error messages

Placeholder values vary, but the wording and punctuation around them MUST match
these templates exactly:

```text
[bun-test-utils] unknown fixture "<NAME>" requested in <FILE>. Available in this explicit test.extend(...) chain: <AVAILABLE>. Compose the fixture with test.extend({ <NAME>: ... }) and import that extended test into this file.

[bun-test-utils] circular fixture dependency: <TRAIL> (<FILE>)

[bun-test-utils] fixture "<NAME>" finished without calling use(value)

[bun-test-utils] networkGuard blocked unexpected fetch: <METHOD> <URL>. Allow it explicitly with networkGuard.allow(...).
```

The contractual network-guard template is also requirement R10 in
[spec 0009](./0009-standard-fixtures-std.md).

## Out of scope

Public `test.each`, `test.skip/only/todo` fixture variants, custom matchers, and public capability helper imports.

## Verification

| Requirement | Test |
|-------------|------|
| R1-R5 | wrapper conformance tests under `packages/bun-test-utils/tests/conformance/` |
| R6-R7 | core tests under `packages/core/tests/` |
| R8 | `bun run typecheck` in CI |
| R9-R10 | wrapper collision conformance in `packages/bun-test-utils/tests/conformance/capabilities.test.ts` |
| R11 | exact contract tests in `packages/core/tests/error-messages.test.ts` and `packages/std/tests/network-guard.test.ts` |

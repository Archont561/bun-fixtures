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
| R2 | The published root package MUST NOT export general implementation helpers, capability subpaths, or default objects; the single explicit helper exception is `propTestSchema`, the typed identity wrapper for reusable PBT schemas. |
| R3 | The root `test` MUST expose built-in fixture context for std, DOM, browser, VCR, and snapshot capabilities. |
| R4 | Property and BDD-style APIs MUST live on `test.*`: `test.prop`, `test.scenario`, and `test.scenario.prop`. |
| R5 | `test.extend(fixtures)` MUST remain the only public composition hook for user fixtures and mocks. |
| R6 | Fixture metadata (`testFile`, `testName`, `scope`, `iterate`) MUST be injectable internally but MUST NOT be treated as user fixtures. |
| R7 | The internal core package MAY export engine helpers for private workspaces; those helpers MUST NOT be re-exported from the public root package. |
| R8 | The package MUST typecheck under `strict` with no `any` leaking into public signatures other than dynamic fixture values. |
| R9 | The root fixture context MUST use one flat namespace containing exactly `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`, `window`, `document`, `page`, `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`, `cassette`, and `snapshot`. |
| R10 | Fixture composition MUST be last-definition-wins: a consumer `test.extend()` definition overrides a built-in key, and a later extension overrides an earlier one. Dependencies MUST resolve the winning definition by key. |
| R11 | The exact human-readable templates for unknown fixtures, circular dependencies, a fixture finishing without `use(value)`, and a fetch blocked by `networkGuard` MUST remain contractual; other diagnostic wording MAY change while machine-readable codes and meaning remain compatible. |
| R12 | `propTestSchema` MUST accept an arbitrary record or fast-check factory, contextually type the factory API, preserve generated-value inference, and return the supplied definition unchanged. |

## Design

The core engine still owns explicit composition, fixture ordering, teardown, stack detection, and scenario execution. The wrapper assembles internal fixture maps once and exports the root runner (`describe`, `expect`, and `test`) plus the single explicitly sanctioned helper `propTestSchema`.

`use` is typed `(value: T) => Promise<void>` rather than `=> void`: a `void` return makes `await use(v)` meaningless and teardown impossible. Awaiting remains optional.

Stack-trace detection compares frames against both `import.meta.path` and its `realpathSync`, because a linked package reports a different path in the stack than in `import.meta`.

### Reusable schemas and scenario steps (task_048)

The task initially selected **types-only plus convention**. Shared scenario steps remain plain functions in consumer-owned modules, explicitly imported and optionally composed by a consumer-owned function that accepts and returns a `GivenChain`. The root declaration exposes type-only helpers for schemas (`FastCheckApi`, `ArbitraryInput`, `GeneratedValues`) and steps (`GivenChain`, `ScenarioContext`, `GivenStep`, `WhenStep`, `ThenStep`). The step types do not change fixture autodetection, scenario reporting, or runtime behavior.

**Sequencing deviation (task_048):** The initial types-only direction was selected before implementation, but this spec note was written after source/test edits had begun. The task criterion requiring a spec/ADR note before code was therefore not met in repository chronology. This is recorded rather than represented as compliant; the task remains `in_progress` until the user explicitly waives or reframes that requirement.

### Revised schema helper decision (ADR 0021)

The user later authorized one top-level runtime helper: `propTestSchema`. It is a typed identity wrapper for either a schema record or a factory. The factory's `fc` parameter is contextually typed as `FastCheckApi`, and the wrapper preserves the exact arbitrary record type for inference at `test.prop` and `test.scenario.prop` call sites. This lets shared schema modules use the helper without importing `FastCheckApi` in each file; ordinary object spread remains the composition convention.

The root runtime exports are now exactly `describe`, `expect`, `propTestSchema`, and `test`. Type-only aliases remain erased. No `test.schema` member, registry, global lookup, capability subpath, or other runtime helper is added. The `Object.keys` conformance gate is updated to pin this four-value surface. ADR 0021 records the revised decision and amends ADRs 0012 and 0013 only as to the additional named root value.

The root declaration still references `fast-check` types for `FastCheckApi` and arbitrary inference. The peer remains optional at runtime, but a strict TypeScript consumer with `skipLibCheck: false` must install `fast-check` even for ordinary root imports; `skipLibCheck: true` avoids checking the missing optional peer declaration. `propTestSchema` itself does not load fast-check at runtime.

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

Public `test.each`, `test.skip/only/todo` fixture variants, custom matchers, capability subpaths, and root helpers other than `propTestSchema`.

## Verification

| Requirement | Test |
|-------------|------|
| R1-R5 | wrapper conformance tests under `packages/bun-test-utils/tests/conformance/` |
| R6-R7 | core tests under `packages/core/tests/` |
| R8 | `bun run typecheck` in CI |
| R9-R10 | wrapper collision conformance in `packages/bun-test-utils/tests/conformance/capabilities.test.ts` |
| R11 | exact contract tests in `packages/core/tests/error-messages.test.ts` and `packages/std/tests/network-guard.test.ts` |
| R12 | `packages/bun-test-utils/tests/conformance/public-api.test.ts` and `shared-definitions.test.ts` verify the named export, identity semantics, contextual factory type, and inferred values |

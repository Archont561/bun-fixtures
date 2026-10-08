# 0004 — Public API and types

- **Status:** implemented/revised
- **Milestone:** M4
- **Implementation:** `packages/bun-test-utils/src/{plugin,pbt,bdd}.ts`, package export map, `packages/core/src/plugin.ts`, `packages/core/src/types.ts`
- **Tests:** `packages/core/tests/{plugin,error-messages}.test.ts`, `packages/std/tests/network-guard.test.ts`, `packages/bun-test-utils/tests/conformance/*.test.ts`, `bun run typecheck`
- **Compatibility:** [ADR 0018](../adr/0018-release-compatibility-contract.md)

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `import { test, expect, describe } from "bun-test-utils"` MUST work with no global monkey-patching. |
| R2 | The package MUST expose only the root runner plus the helper-only `./pbt` and `./bdd` subpaths (and `./package.json`); it MUST NOT expose runner/fixture subpaths, general implementation helpers, default objects, or any other subpaths. |
| R3 | The root `test` MUST expose built-in fixture context for std, DOM, browser, VCR, and snapshot capabilities. |
| R4 | Property and BDD-style APIs MUST live on `test.*`: `test.prop`, `test.scenario`, and `test.scenario.prop`. |
| R5 | `test.extend(fixtures)` MUST remain the only public composition hook for user fixtures and mocks. |
| R6 | Fixture metadata (`testFile`, `testName`, `scope`, `iterate`) MUST be injectable internally but MUST NOT be treated as user fixtures. |
| R7 | The internal core package MAY export engine helpers for private workspaces; those helpers MUST NOT be re-exported from the public root package. |
| R8 | The package MUST typecheck under `strict` with no `any` leaking into public signatures other than dynamic fixture values. |
| R9 | The root fixture context MUST use one flat namespace containing exactly `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`, `window`, `document`, `page`, `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`, `cassette`, and `snapshot`. |
| R10 | Fixture composition MUST be last-definition-wins: a consumer `test.extend()` definition overrides a built-in key, and a later extension overrides an earlier one. Dependencies MUST resolve the winning definition by key. |
| R11 | The exact human-readable templates for unknown fixtures, circular dependencies, a fixture finishing without `use(value)`, and a fetch blocked by `networkGuard` MUST remain contractual; other diagnostic wording MAY change while machine-readable codes and meaning remain compatible. |
| R12 | `bun-test-utils/pbt` MUST export `defineArbitraries`, accepting an arbitrary record or fast-check factory, contextually typing the factory API, preserving generated-value inference, and returning the supplied definition unchanged. |
| R13 | `bun-test-utils/bdd` MUST export `givenStep`, `whenStep`, and `thenStep` identity wrappers with contextual input/output-state typing, plus the related scenario type aliases; each wrapper returns its callback unchanged. |

## Design

The core engine still owns explicit composition, fixture ordering, teardown, stack detection, and scenario execution. The root package exposes the runner (`describe`, `expect`, and `test`); typed definition helpers are capability-scoped under `bun-test-utils/pbt` and `bun-test-utils/bdd`.

`use` is typed `(value: T) => Promise<void>` rather than `=> void`: a `void` return makes `await use(v)` meaningless and teardown impossible. Awaiting remains optional.

Stack-trace detection compares frames against both `import.meta.path` and its `realpathSync`, because a linked package reports a different path in the stack than in `import.meta`.

### Reusable schemas and scenario steps (task_048)

The task initially selected **types-only plus convention**. In that initial implementation, shared scenario steps were plain functions in consumer-owned modules, explicitly imported and optionally composed by a consumer-owned function that accepts and returns a `GivenChain`; the root declaration exposed the schema and step type aliases. That root placement is historical and was superseded by ADR 0021 and then ADR 0022. The step types do not change fixture autodetection, scenario reporting, or runtime behavior.

**Sequencing deviation (task_048):** The initial types-only direction was selected before implementation, but this spec note was written after source/test edits had begun. The task criterion requiring a spec/ADR note before code was therefore not met in repository chronology. This is recorded rather than represented as compliant; the task remains `in_progress` until the user explicitly waives or reframes that requirement.

### Earlier root-helper decision (ADR 0021; superseded by ADR 0022)

The user first authorized `propTestSchema` as a top-level runtime identity wrapper for a schema record or factory. It contextually typed a factory's `fc` parameter and preserved arbitrary inference, but ADR 0022 supersedes that placement.

### Capability-scoped typed helpers (ADR 0022)

`bun-test-utils/pbt` exports `defineArbitraries` and the PBT type aliases `FastCheckApi`, `ArbitraryInput`, and `GeneratedValues`. `bun-test-utils/bdd` exports the phase-specific identity wrappers `givenStep`, `whenStep`, and `thenStep`, along with `ScenarioContext`, `GivenChain`, `GivenStep`, `WhenStep`, and `ThenStep`. Each wrapper returns its callback unchanged while providing the corresponding generic step signature. The root runtime surface is again exactly `describe`, `expect`, and `test`; the only package subpaths are the helper-only `/pbt` and `/bdd` exports plus `/package.json`. They expose no runners or fixtures, and no other root helper or `test.*` member is added. ADR 0023 records the pre-release rename from `propTestSchema` to `defineArbitraries`.

The declarations still reference `fast-check` types for PBT inference. The peer remains optional at runtime, but a strict TypeScript consumer with `skipLibCheck: false` may need to install `fast-check` even for ordinary root imports; `skipLibCheck: true` avoids checking a missing optional peer declaration. Neither the PBT definition helper nor the BDD step wrappers load an optional peer at runtime.

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

Public `test.each`, `test.skip/only/todo` fixture variants, custom matchers, runner/fixture subpaths, any capability helper subpaths other than `./pbt` and `./bdd`, and additional root helpers.

## Verification

| Requirement | Test |
|-------------|------|
| R1-R5 | wrapper conformance tests under `packages/bun-test-utils/tests/conformance/` |
| R6-R7 | core tests under `packages/core/tests/` |
| R8 | `bun run typecheck` in CI |
| R9-R10 | wrapper collision conformance in `packages/bun-test-utils/tests/conformance/capabilities.test.ts` |
| R11 | exact contract tests in `packages/core/tests/error-messages.test.ts` and `packages/std/tests/network-guard.test.ts` |
| R12-R13 | `packages/bun-test-utils/tests/conformance/public-api.test.ts` and shared definitions verify helper subpath exports, identity semantics, contextual factory/step typing, and inferred values |

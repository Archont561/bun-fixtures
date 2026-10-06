# 0004 — Public API and types

- **Status:** implemented/revised
- **Milestone:** M4
- **Implementation:** `packages/bun-test-utils/src/plugin.ts`, `packages/core/src/plugin.ts`, `packages/core/src/types.ts`
- **Tests:** `packages/core/tests/plugin.test.ts`, `packages/bun-test-utils/tests/conformance/*.test.ts`, `bun run typecheck`

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

## Design

The core engine still owns explicit composition, fixture ordering, teardown, stack detection, and scenario execution. The wrapper assembles internal fixture maps once and exports a single user-facing API.

`use` is typed `(value: T) => Promise<void>` rather than `=> void`: a `void` return makes `await use(v)` meaningless and teardown impossible. Awaiting remains optional.

Stack-trace detection compares frames against both `import.meta.path` and its `realpathSync`, because a linked package reports a different path in the stack than in `import.meta`.

## Out of scope

Public `test.each`, `test.skip/only/todo` fixture variants, custom matchers, and public capability helper imports.

## Verification

| Requirement | Test |
|-------------|------|
| R1-R5 | wrapper conformance tests under `packages/bun-test-utils/tests/conformance/` |
| R6-R7 | core tests under `packages/core/tests/` |
| R8 | `bun run typecheck` in CI |

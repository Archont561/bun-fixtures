# 0004 — Public API and types

- **Status:** implemented
- **Milestone:** M4
- **Implementation:** `packages/bun-fixture/src/plugin.ts`, `src/types.ts`
- **Tests:** `packages/core/tests/plugin.test.ts`, `bunx tsc --noEmit`

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `import { test, expect, describe } from "bun-fixture"` MUST work with no global monkey-patching |
| R2 | The top-level `test` MUST detect its own file from the stack trace, including frames without a column number and through symlinked (`npm link`, `bunx`) package paths |
| R3 | `createTest(file?)` MUST return `{ test, describe, expect }` bound to an explicit file |
| R4 | `test(name, fn, opts?)` MUST accept `{ fixtures?: string[]; timeout?: number; iterate?: boolean }`; with `iterate: true` the context MUST carry an `iterate` runner and MUST NOT hold test-scoped values |
| R5 | Context metadata (`testFile`, `testName`, `param`, `scope`, `iterate`) MUST be injectable but MUST NOT be treated as fixtures |
| R6 | `FixtureDef`, `Scope`, `FixtureContext`, `FixtureMap`, `TestOptions`, `UseFn`, `IterateFn` MUST be exported as types |
| R7 | Engine internals (`discoverFixtures`, `registerFixtures`, `fixturesFor`, `resolveOrder`, `paramCombos`, `destructuredKeys`, `detectFixtures`, `callerFile`, `teardownFile`, `teardownSession`) SHOULD be exported for tooling |
| R8 | The package MUST typecheck under `strict` with no `any` leaking into signatures other than fixture values |

## Design

`use` is typed `(value: T) => Promise<void>` rather than the originally
specified `=> void`: a `void` return makes `await use(v)` meaningless and
teardown impossible. Awaiting remains optional.

Stack-trace detection compares frames against both `import.meta.path` and its
`realpathSync`, because a linked package reports a different path in the stack
than in `import.meta`.

## Out of scope

`test.each`, `test.skip/only/todo` with fixtures, custom matchers.

## Verification

| Requirement | Test |
|-------------|------|
| R2 | every test in `tests/plugin.test.ts` (top-level `test`), "exposes test metadata on the context" |
| R3 | "createTest binds to an explicit file", all of `tests/nested/nested.test.ts` |
| R4 | "supports an explicit fixture list", "a fresh project…" (`{ timeout: 30_000 }`), all of "iteration protocol (opts.iterate)" |
| R5 | "exposes test metadata on the context" |
| R8 | `bunx tsc --noEmit` in CI |

# 0006 — Behavioural (Gherkin) test suite

- **Status:** implemented
- **Milestone:** M4
- **Implementation:** package-owned `features/*.feature` files, the shared step definitions in `packages/bun-test-utils/tests/steps/fixtures.steps.ts`, and their scratch-project harness in `packages/bun-test-utils/tests/support/project.ts`
- **Entrypoint:** `packages/config/bdd/features.test.ts` — `bun run test:bdd`

## Problem

The dogfooding suite tests focused engine internals in process. That is fast and precise, but it cannot catch everything about the experience of actually using the package — preload wiring, explicit `test.extend()` composition from real files, `bun test` output, exit codes, CLI side effects — and it is coupled to internal names.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | Behaviour MUST be specified in Gherkin, readable without knowing the implementation |
| R2 | Each scenario MUST run against a real throwaway project: its own directory, `bunfig.toml`, `node_modules/bun-test-utils`, and a real `bun test` subprocess |
| R3 | Steps MUST NOT import the fixture engine — only files, process output, and exit codes |
| R4 | Scenarios MUST cover scopes, LIFO teardown, teardown after failure, explicit composition and overriding, graph validation errors, parameterization, and CLI `init` |
| R5 | Scratch projects MUST be removed after each scenario |
| R6 | The suite MUST run under plain `bun test` alongside the unit suite |

## Design

`@aboviq/bun-test-cucumber` compiles each `.feature` into `describe`/`it` via a
Bun loader plugin. Bun's scanner ignores `.feature` files
([oven-sh/bun#3440](https://github.com/oven-sh/bun/issues/3440)), so the shared
`packages/config/bdd/features.test.ts` entrypoint registers the plugin and loads each
package's features with `loadFeatures`.

Scenario state (`{ project, lastRun }`) flows through the typed `withState`
helper. `packages/bun-test-utils/tests/support/project.ts` owns the harness: `createProject`,
`writeProjectFile`, `runTests`, `runCli`, `removeProject`. The Bun binary used
for subprocesses is `process.execPath`, so the suite tests the same runtime it
runs on.

Because each step becomes its own `it`, a failing scenario reports the exact
step that broke, and each step gets its own timeout.

## Relationship to the unit suite

| | unit tests | `features/*.feature` |
|---|---|---|
| Level | internals, in-process | user-visible, subprocess |
| Speed | ~100 ms | ~400 ms |
| Breaks when | internals change | behaviour changes |

Both are required; neither replaces the other.

## Verification

`bun run test:bdd` — feature files covering explicit composition, scopes, validation, parameterization, CLI init, and capability packs. Verified sensitive by
mutation: flipping an expected occurrence count in
`features/fixture-scopes.feature` fails exactly the step that asserts it.

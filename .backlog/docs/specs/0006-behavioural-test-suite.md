# 0006 — Behavioural (Gherkin) test suite

- **Status:** implemented
- **Milestone:** M4
- **Implementation:** `packages/bun-fixture/{features,tests}/` — `features/*.feature`, `tests/steps/*.steps.ts`, `tests/support/project.ts`, `test-plugins.ts`
- **Entrypoint:** `packages/bun-fixture/tests/features.test.ts` — `bun run test:bdd`

## Problem

The dogfooding suite tests the engine *from the inside*: it imports
`resolveOrder`, inspects `fixturesFor`, and shares a process with the fixtures
it exercises. That is fast and precise, but it cannot catch anything about the
experience of actually using the package — preload wiring, discovery from a
real cwd, `bun test` output, exit codes, CLI side effects — and it is coupled
to internal names.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | Behaviour MUST be specified in Gherkin, readable without knowing the implementation |
| R2 | Each scenario MUST run against a real throwaway project: its own directory, `bunfig.toml`, `node_modules/bun-fixture`, and a real `bun test` subprocess |
| R3 | Steps MUST NOT import the fixture engine — only files, process output, and exit codes |
| R4 | Scenarios MUST cover scopes, LIFO teardown, teardown after failure, directory discovery and overriding, graph validation errors, parameterization, and CLI `init` |
| R5 | Scratch projects MUST be removed after each scenario |
| R6 | The suite MUST run under plain `bun test` alongside the unit suite |

## Design

`@aboviq/bun-test-cucumber` compiles each `.feature` into `describe`/`it` via a
Bun loader plugin, registered in `test-plugins.ts` and preloaded next to
`src/plugin.ts`. Bun's scanner ignores `.feature` files
([oven-sh/bun#3440](https://github.com/oven-sh/bun/issues/3440)), so
`tests/features.test.ts` loads them with `loadFeatures`.

Scenario state (`{ project, lastRun }`) flows through the typed `withState`
helper. `tests/support/project.ts` owns the harness: `createProject`,
`writeProjectFile`, `runTests`, `runCli`, `removeProject`. The Bun binary used
for subprocesses is `process.execPath`, so the suite tests the same runtime it
runs on.

Because each step becomes its own `it`, a failing scenario reports the exact
step that broke, and each step gets its own timeout.

## Relationship to the unit suite

| | `tests/fixtures.test.ts` | `features/*.feature` |
|---|---|---|
| Level | internals, in-process | user-visible, subprocess |
| Speed | ~100 ms | ~400 ms |
| Breaks when | internals change | behaviour changes |

Both are required; neither replaces the other.

## Verification

`bun run test:bdd` — 5 feature files, 20 scenarios. Verified sensitive by
mutation: flipping an expected occurrence count in
`features/fixture-scopes.feature` fails exactly the step that asserts it.

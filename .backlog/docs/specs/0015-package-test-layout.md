# 0015 — Package test layout

- **Status:** implemented
- **Implementation:** `packages/*/src`, `packages/*/tests`, `packages/*/e2e`
- **Tests:** `packages/config/tests/` (the `runPackageFeatures` helper), `packages/*/e2e/bdd/features.test.ts`

## Problem

Without one stated layout, packages drift: unit tests reach for Gherkin discovery,
feature files collect in a top-level directory, and each runner restates the
repository root and glob patterns differently. This spec fixes the layout and the
required entrypoint form; the rationale is in
[ADR 0016](../adr/0016-package-test-layout-and-e2e-bdd.md) and
[ADR 0017](../adr/0017-shared-bdd-runner-helper.md).

## Requirements

Every runtime package follows this layout:

```text
src/                 production code
tests/unit/          isolated implementation tests
tests/integration/   internal cross-module tests
e2e/                 black-box consumer tests
e2e/bdd/features/    Gherkin workflows
e2e/bdd/steps/       step definitions
e2e/bdd/features.test.ts  package-owned BDD entrypoint
```

A BDD scenario belongs in `e2e/bdd` when it describes a user or consumer workflow
or crosses a public package boundary. Unit and integration tests must not depend on
Gherkin discovery.

`e2e/bdd/features.test.ts` is the required entrypoint form, and it MUST be exactly one
call into the shared helper ([ADR-0017](../adr/0017-shared-bdd-runner-helper.md)):

```ts
import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("<package-dir>", import.meta);
```

A runner MUST NOT restate the repository root, the feature or step globs, or the plugin
registration; the helper derives all of them, and rejects a runner that is not at
`packages/<package-dir>/e2e/bdd/features.test.ts`. Step definitions stay discoverable
repo-wide (`packages/*/e2e/bdd/steps/**/*.steps.ts`), so shared steps serve every package.

Required scripts for runtime packages:

```json
{
  "test": "bun test tests",
  "test:bdd": "bun test e2e/bdd/features.test.ts",
  "test:e2e": "bun test e2e"
}
```

Packages without direct E2E scenarios may retain the scripts for workspace-level
consistency, but their runner must not discover another package's features.

## Test styles by layer

Which styles a suite may use is a function of the layer, not of taste. Property
coverage is added only where a real algebraic invariant exists; BDD stays a
consumer-workflow language.

| Layer | Example-based | Property-based (`test.prop` / `@bun-test-utils/pbt`) | BDD (Gherkin) |
|-------|---------------|------------------------------------------------------|---------------|
| Trust anchor (`packages/core`) | unit tests in `tests/` | **no** — a core devDependency on pbt would cycle the turbo graph. Engine combinatorics (`paramCombos`, `resolveOrder`) and iterate-protocol LIFO are property-tested from `packages/pbt/tests`. | consumer workflows in `e2e/bdd` |
| Capability packs | unit tests in `tests/` | algebraic invariants in `tests/` for **vcr** (record→replay identity; method+URL matching), **snapshot** (serialization stability / key-order fixed point), and **std** (env round-trip; tmpdir path handling). **Not** `dom` (thin glue over happy-dom, weak invariants) or `browser` (Playwright subprocess; randomized runs are slow and flaky). | consumer workflows only; no unit-level Gherkin |
| Wrapper (`packages/bun-test-utils`) | conformance + e2e | the cross-cutting matrix: `tests/conformance/style-matrix.test.ts` (fileless cells over the assembled root) and `e2e/style-matrix.test.ts` (the file-bearing snapshot and HTTP-cassette cells, in a scratch project) | consumer-workflow Gherkin; exactly one seeded prop-inside-BDD scenario (`e2e/bdd/features/property.feature`) |

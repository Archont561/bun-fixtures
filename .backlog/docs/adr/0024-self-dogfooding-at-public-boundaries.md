# 0024 — Self-dogfooding at public boundaries

- **Status:** accepted
- **Date:** 2026-10-08

## Context

`bun-test-utils` is both a testing library and a Bun workspace containing its own
implementation, documentation, CLI, and end-to-end suites. Tests that import
private workspace packages can prove implementation details while missing the
failures that consumers see: packaging mistakes, missing exports, duplicated
bundled state, broken declarations, and incorrect preload behavior.

The repository already has three useful test shapes:

- package unit tests for internal engine behavior;
- public conformance tests importing `bun-test-utils` and its public subpaths;
- temporary consumer projects that run the built package as an installed user
  would.

New features such as snapshot global serializers, scaffold generation,
monorepo coverage, reports, and the future MCP server make this boundary more
important. A feature is not complete merely because its private workspace test
passes.

## Decision

Self-dogfood each feature at three boundaries:

1. **Internal unit boundary** — package-owned tests may import the private
   `@bun-test-utils/*` workspace and test implementation details.
2. **Public API boundary** — conformance tests import only published-style
   entrypoints such as `bun-test-utils`, `bun-test-utils/bdd`,
   `bun-test-utils/pbt`, and `bun-test-utils/snap`. These tests pin the public
   exports and declaration behavior.
3. **Installed-consumer boundary** — E2E tests create a temporary project,
   consume the built or packed public package, run `bun test`, and inspect the
   resulting files, exit code, and artifacts. CLI commands are invoked as
   subprocesses rather than imported directly.

The root package's own tests should use the public runner and built-in fixture
composition wherever possible. Internal imports remain appropriate only for
focused package tests and implementation-level diagnostics.

Every new public capability should add, where applicable:

- a focused unit test;
- a public conformance test;
- an installed-consumer test;
- documentation using the public import path;
- a packaging/exports assertion when it adds a subpath or generated artifact.

The consumer E2E path must build before execution when it relies on generated
`dist/` files. It must not rely on source aliases or private workspace paths.

## Consequences

### Good

- Packaging and bundling regressions are caught before publication.
- Public export decisions remain explicit and reviewable.
- Duplicate bundled module state, such as global serializer registries, is tested
  in the environment where it matters.
- CLI, report, coverage, and future MCP features are tested as users invoke
  them.
- The repository demonstrates the practices it recommends to consumers.

### Bad

- Consumer E2E tests are slower and more involved than package unit tests.
- A feature may need more than one test shape before it can be marked done.
- Generated artifacts and optional dependencies need explicit test-environment
  handling.

## Alternatives considered

- **Test only private workspaces:** rejected because it misses publication,
  exports, bundling, and installed-consumer failures.
- **Test only the root package:** rejected because it makes engine failures hard
  to isolate and slows every feedback loop.
- **Use source imports in consumer fixtures:** rejected because source imports
  do not prove the package that users install.
- **Make the browser report or MCP server the source of truth:** rejected. Bun
  remains the test runner; local reports and MCP consume versioned artifacts.

## Implementation pattern

```text
packages/<capability>/tests/       internal behavior
packages/bun-test-utils/tests/     public conformance
packages/bun-test-utils/e2e/       installed consumer behavior
```

A feature's definition of done includes all applicable boundaries, and the
Backlog task should name any boundary that is intentionally deferred.

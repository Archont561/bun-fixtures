# Repo-wide refactor audit — 2026-10-06

## Scope

Reviewed production sources under `packages/*/src` and `apps/*/src`, package scripts,
TypeScript configuration, and the existing test layout. The largest implementation
surfaces are `packages/core/src/plugin.ts`, `packages/browser/src/index.ts`,
`packages/pbt/src/index.ts`, `packages/vcr/src/cassette.ts`,
`packages/snapshot/src/snapshot.ts`, and `packages/dom/src/index.ts`.

## Ranked findings

1. **High — filesystem helpers accepted paths outside the temporary directory.**
   `packages/std/src/tmpdir.ts` joined user-provided path segments directly. `..`
   could escape the fixture directory for read, write, remove, and existence checks.
   **Resolution:** centralized path resolution and rejection in `resolveInside`; all
   helper operations now use it.
2. **Medium — dynamic integration boundaries use broad `any` types.** Browser,
   PBT, BDD, and core plugin adapters intentionally bridge optional dependencies and
   Bun internals, but the broad casts obscure the supported surface. Follow-up should
   introduce narrow adapter interfaces package by package, starting with Playwright
   and fast-check.
3. **Medium — core/plugin.ts concentrates registration, fixture lifecycle, BDD
   integration, and compatibility shims in one module.** Split only along stable
   internal boundaries after characterization tests are added; a broad rewrite would
   carry unnecessary regression risk.
4. **Medium — global environment and DOM fixtures mutate process/global state.**
   Existing `try/finally` cleanup is good, but concurrent-test assumptions should be
   documented and tests should cover setup failures and overlapping fixtures.
5. **Low — large test files duplicate fake adapters.** Extract shared test doubles only
   after each package's behavioral contract is explicit; production consolidation is
   not justified by textual similarity alone.

## Deferred work

- Add characterization tests for optional dependency loading and global restoration.
- Replace `any` at optional-dependency boundaries with package-local minimal interfaces.
- Split `core/plugin.ts` internally without changing exports or import paths.
- Add a CI audit check for TODO/FIXME additions and accidental public API changes.

## Verification

The path containment change is behavior-preserving for valid relative paths and rejects
unsafe traversal before filesystem access. Run `bun run lint`, `bun run typecheck`, and
the relevant std package tests before merging.

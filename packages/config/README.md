# Shared build configuration

`@bun-test-utils/config` is a private workspace package used by the repository's TypeScript and Bunup configuration. It is not a consumer-facing runtime package.

> Repository runtime packages use explicit fixture composition. `fixtures.ts` and `conftest.ts` are not automatically loaded by bun-test-utils; consumer tests import runner values from the root and typed definition/serializer helpers from the approved `/pbt`, `/bdd`, `/snap`, and `/vcr` subpaths; capability fixtures are provided through the root `test` context.

It centralizes the strict library/app compiler presets, the Bunup configuration factory used by capability packs, and the shared BDD runner helper. Runtime packages keep their own entrypoint at `e2e/bdd/features.test.ts`, reduced to a single `runPackageFeatures("<package-dir>", import.meta)` call ([ADR-0017](../../.backlog/docs/adr/0017-shared-bdd-runner-helper.md)); consumer tests should import from `@archont561/bun-test-utils`, not from this package.

```bash
bun install
bun run typecheck
bun run build
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

BDD runners are owned by each runtime package under `e2e/bdd/`. This package exposes the shared presets and runner helper they call; it owns unit tests for those exports (`bun test tests`), never a repository-wide suite.

# Shared build configuration

`@bun-test-utils/config` is a private workspace package used by the repository's TypeScript and Bunup configuration. It is not a consumer-facing runtime package.

> Repository runtime packages use explicit fixture composition. `fixtures.ts` and `conftest.ts` are not automatically loaded by bun-test-utils; consumer tests import `describe`, `test`, and `expect` from `bun-test-utils`; capability fixtures are provided through the root `test` context.

It centralizes the strict library/app compiler presets, the Bunup configuration factory used by capability packs, and shared BDD runner presets. BDD runners are owned by runtime packages under `e2e/bdd/`; consumer tests should import from `bun-test-utils`, not from this package.

```bash
bun install
bun run typecheck
bun run build
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

BDD runners are owned by each runtime package under `e2e/bdd/`. This package exposes shared presets only; it does not own a test suite.

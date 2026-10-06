# Shared build configuration

`@bun-test-utils/config` is a private workspace package used by the repository's TypeScript and Bunup configuration. It is not a consumer-facing runtime package.

> Repository runtime packages use explicit fixture composition. `fixtures.ts` and `conftest.ts` are not automatically loaded by bun-test-utils; consumer tests import `describe`, `test`, and `expect` from `bun-test-utils`; capability fixtures are provided through the root `test` context.

It centralizes the strict library/app compiler presets, the Bunup configuration factory used by capability packs, and the repository-wide BDD runner configuration. Consumer tests should import from `bun-test-utils`, not from this package.

```bash
bun install
bun run typecheck
bun run build
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

The repository-wide BDD entrypoint lives at `bdd/features.test.ts` in this workspace so the shared test configuration stays together with the other monorepo configuration. Run it from the repository root with `bun run test:bdd`.

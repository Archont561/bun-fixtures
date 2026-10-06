# Shared build configuration

`@bun-test-utils/config` is a private workspace package used by the repository's TypeScript and Bunup configuration. It is not a consumer-facing runtime package.

> Repository runtime packages use explicit fixture composition. `fixtures.ts` and `conftest.ts` are not automatically loaded by bun-test-utils; consumer tests import a `test.extend()` runner from `bun-test-utils` or a capability subpath.

It centralizes the strict library/app compiler presets and the Bunup configuration factory used by capability packs. Consumer tests should import from `bun-test-utils`, not from this package.

```bash
bun install
bun run typecheck
bun run build
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

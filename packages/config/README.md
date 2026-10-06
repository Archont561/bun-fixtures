# Shared build configuration

`@bun-test-utils/config` is a private workspace package used by the repository's TypeScript and Bunup configuration. It is not a consumer-facing runtime package.

It centralizes the strict library/app compiler presets and the Bunup configuration factory used by capability packs. Consumer tests should import from `bun-test-utils`, not from this package.

```bash
bun install
bun run typecheck
bun run build
```

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

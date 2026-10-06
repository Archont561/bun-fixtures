# @bun-test-utils/config

> **Internal workspace.** Build-time-only shared configuration; never published, and not a
> runtime subpath of the published `bun-test-utils` package.

Single source of truth for the monorepo's TypeScript configurations and for the shared
Bunup build contract ([spec 0008](../../.backlog/docs/specs/0008-typescript-config-package.md),
[ADR 0014](../../.backlog/docs/adr/0014-bunup-built-publication.md)).

## TypeScript configurations

| File | Subpath | Role |
| --- | --- | --- |
| `base.json` | `@bun-test-utils/config/base` | Strict base every package extends |
| `lib.json` | `@bun-test-utils/config/lib` | Library packages (code under `src/`) |
| `app.json` | `@bun-test-utils/config/app` | Applications (the docs site) |

Workspace packages extend one of these in their local `tsconfig.json`, keeping `strict`
and target alignment identical everywhere without copy-paste.

## Bunup factory

`@bun-test-utils/config/bunup` exports the typed `createBunupConfig(entry, overrides?)`
factory. It produces the shared build shape every code workspace adopts through a local
`bunup.config.ts`:

- Bun-targeted ESM to `dist/` with `src` as the source base
- TypeScript declarations with `inferTypes`
- third-party packages external (`playwright`, `happy-dom`, `fast-check`, `citty`, `smol-toml`)
- `splitting: false`, `clean: true`

Per-workspace overrides stay local — e.g. the published wrapper passes `noExternal` for the
private `@bun-test-utils/*` implementations so they bundle into the public entries, and a
repository-root `dts` context so private workspace types bundle without leaking private
package imports.

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.

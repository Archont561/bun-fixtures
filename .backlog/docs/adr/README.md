# Architecture decision records

Short, immutable records of *why*. Supersede rather than rewrite.

| # | Decision | Status |
|---|----------|--------|
| [0001](./0001-preload-not-bun-plugin.md) | Preload script, not `Bun.plugin()` | accepted |
| [0002](./0002-path-based-directory-scoping.md) | Path-based directory scoping | accepted |
| [0003](./0003-raw-ts-distribution.md) | Ship raw TypeScript | superseded by 0014 |
| [0004](./0004-smol-toml-for-cli.md) | `smol-toml` for `bunfig.toml` edits | accepted |
| [0005](./0005-explicit-import-no-global-patch.md) | Explicit import, no global monkey-patch | accepted |
| [0006](./0006-use-returns-a-promise.md) | `use` returns a promise | accepted |
| [0007](./0007-file-scope-closes-on-file-switch.md) | File scope closes on file switch | accepted |
| [0008](./0008-no-root-fixtures-file.md) | No repository-root `fixtures.ts` | accepted |
| [0009](./0009-citty-for-the-cli.md) | citty for the CLI | accepted |
| [0010](./0010-monorepo-layout.md) | Monorepo layout | accepted |
| [0011](./0011-brand-identity-and-modular-ecosystem.md) | Brand identity and modular ecosystem architecture | superseded by 0013 |
| [0012](./0012-bdd-fixture-bridge.md) | BDD fixture bridge: narrow the Gherkin non-goal | accepted |
| [0013](./0013-published-wrapper-internal-workspaces.md) | Published wrapper over internal workspaces | partially superseded by 0014 |
| [0014](./0014-bunup-built-publication.md) | Publish Bunup-built ESM and declarations | accepted |
| [0015](./0015-per-package-readmes-concise-root.md) | Per-package READMEs with a concise canonical root | accepted |

Start from [`TEMPLATE.md`](./TEMPLATE.md).

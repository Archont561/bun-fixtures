# Specifications

One numbered spec per component. A spec describes **required behaviour** and how
it is verified; rationale belongs in [`../adr`](../adr), scheduling in
[`../milestones`](../milestones).

| # | Spec | Status | Implementation |
|---|------|--------|----------------|
| [0001](./0001-fixture-engine.md) | Fixture engine — scopes, teardown, DI, params | implemented | `packages/core/src/plugin.ts` |
| [0002](./0002-discovery-and-merge.md) | Legacy preload discovery + directory merge | superseded | removed; use `test.extend()` |
| [0003](./0003-cli-init.md) | CLI `init` | implemented | `packages/core/src/cli.ts` |
| [0004](./0004-public-api-and-types.md) | Public API + types | implemented | `packages/core/src/plugin.ts`, `packages/core/src/types.ts` |
| [0005](./0005-packaging-and-release.md) | Packaging and release | in progress | `packages/*/package.json`, `.changeset/` |
| [0006](./0006-behavioural-test-suite.md) | Behavioural (Gherkin) test suite | implemented | `packages/*/features/`, `packages/config/bdd/` |
| [0007](./0007-apps-docs-starlight.md) | Documentation site with Astro Starlight & GitHub Pages | implemented | `apps/docs/`, `.github/workflows/docs.yml` |
| [0008](./0008-typescript-config-package.md) | Monorepo-wide TypeScript Configuration Package | implemented | `packages/config/`, `tsconfig.json` |
| [0009](./0009-standard-fixtures-std.md) | Standard Built-in Fixtures (tmpdir, env, stdio) | implemented | `packages/std/` |
| [0010](./0010-property-based-testing-fastcheck.md) | Property-Based Testing Integration with fast-check | implemented | `packages/pbt/` |
| [0011](./0011-dom-and-browser-fixtures.md) | DOM and Browser Testing Support (happy-dom & Playwright) | implemented | `packages/dom/`, `packages/browser/` |
| [0012](./0012-http-cassette-vcr.md) | HTTP Cassette / VCR Testing Fixture | implemented | `packages/vcr/` |
| [0013](./0013-snapshot-testing.md) | Snapshot Testing Fixture | implemented | `packages/snapshot/` |
| [0014](./0014-bdd-fixture-bridge.md) | BDD-style scenarios on `test.*` | implemented | `packages/core/`, `packages/bdd/` |

Start a new one from [`TEMPLATE.md`](./TEMPLATE.md).

Keywords **MUST**, **SHOULD**, **MAY** are used as in RFC 2119.

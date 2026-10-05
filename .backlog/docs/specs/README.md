# Specifications

One numbered spec per component. A spec describes **required behaviour** and how
it is verified; rationale belongs in [`../adr`](../adr), scheduling in
[`../milestones`](../milestones).

| # | Spec | Status | Implementation |
|---|------|--------|----------------|
| [0001](./0001-fixture-engine.md) | Fixture engine — scopes, teardown, DI, params | implemented | `packages/bun-fixture/src/plugin.ts` |
| [0002](./0002-discovery-and-merge.md) | Preload discovery + directory merge | implemented | `packages/bun-fixture/src/plugin.ts` |
| [0003](./0003-cli-init.md) | CLI `init` | implemented | `packages/bun-fixture/src/cli.ts` |
| [0004](./0004-public-api-and-types.md) | Public API + types | implemented | `packages/bun-fixture/src/plugin.ts`, `packages/bun-fixture/src/types.ts` |
| [0005](./0005-packaging-and-release.md) | Packaging and release | in progress | `packages/*/package.json`, `.changeset/` |
| [0006](./0006-behavioural-test-suite.md) | Behavioural (Gherkin) test suite | implemented | `packages/bun-fixture/features/`, `packages/bun-fixture/tests/steps/` |
| [0007](./0007-apps-docs-starlight.md) | Documentation site with Astro Starlight & GitHub Pages | implemented | `apps/docs/`, `.github/workflows/docs.yml` |
| [0008](./0008-typescript-config-package.md) | Monorepo-wide TypeScript Configuration Package | implemented | `packages/config/`, `tsconfig.json` |
| [0009](./0009-standard-fixtures-std.md) | Standard Built-in Fixtures (tmpdir, env, stdio) | partial — not yet dogfooded | `packages/std/` |
| [0010](./0010-property-based-testing-fastcheck.md) | Property-Based Testing Integration with fast-check | partial — no per-iteration fixture lifecycle | `packages/fast-check/` |
| [0011](./0011-dom-and-browser-fixtures.md) | DOM and Browser Testing Support (happy-dom & Playwright) | partial — Playwright path untested | `packages/dom/`, `packages/browser/` |
| [0012](./0012-http-cassette-vcr.md) | HTTP Cassette / VCR Testing Fixture | partial — no `__cassettes__/` convention | `packages/vcr/` |

Start a new one from [`TEMPLATE.md`](./TEMPLATE.md).

Keywords **MUST**, **SHOULD**, **MAY** are used as in RFC 2119.

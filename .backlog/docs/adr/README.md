# Architecture decision records

Short, immutable records of *why*. Supersede rather than rewrite.

| # | Decision | Status |
|---|----------|--------|
| [0001](./0001-preload-not-bun-plugin.md) | Preload script, not `Bun.plugin()` | accepted |
| [0002](./0002-path-based-directory-scoping.md) | Path-based directory scoping | superseded |
| [0003](./0003-raw-ts-distribution.md) | Ship raw TypeScript | superseded by 0014 |
| [0004](./0004-smol-toml-for-cli.md) | `smol-toml` for `bunfig.toml` edits | accepted |
| [0005](./0005-explicit-import-no-global-patch.md) | Explicit import, no global monkey-patch | accepted |
| [0006](./0006-use-returns-a-promise.md) | `use` returns a promise | accepted |
| [0007](./0007-file-scope-closes-on-file-switch.md) | File scope closes on file switch | accepted |
| [0008](./0008-no-root-fixtures-file.md) | No repository-root `fixtures.ts` | superseded |
| [0009](./0009-citty-for-the-cli.md) | citty for the CLI | accepted |
| [0010](./0010-monorepo-layout.md) | Monorepo layout | accepted |
| [0011](./0011-brand-identity-and-modular-ecosystem.md) | Brand identity and modular ecosystem architecture | superseded by 0013 |
| [0012](./0012-bdd-fixture-bridge.md) | BDD fixture bridge: narrow the Gherkin non-goal | accepted, amended by 0021 and 0022 |
| [0013](./0013-published-wrapper-internal-workspaces.md) | Published wrapper over internal workspaces | partially superseded by 0014, amended by 0021, 0022, and 0028 |
| [0014](./0014-bunup-built-publication.md) | Publish Bunup-built ESM and declarations | accepted |
| [0015](./0015-per-package-readmes-concise-root.md) | Per-package READMEs with a concise canonical root | accepted |
| [0016](./0016-package-test-layout-and-e2e-bdd.md) | Package test layout and E2E BDD | accepted, amended by 0017 |
| [0017](./0017-shared-bdd-runner-helper.md) | Shared BDD runner helper in the config workspace | accepted |
| [0018](./0018-release-compatibility-contract.md) | Release stability, fixture-key collisions, error messages, and platforms | accepted, amended by 0020 |
| [0019](./0019-no-base-directory-override-in-0-1-x.md) | No base-directory override for the cassette and snapshot conventions in 0.1.x | accepted |
| [0020](./0020-remove-parameterized-fixtures.md) | Remove parameterized fixtures; `test.prop` covers the axis | accepted |
| [0021](./0021-prop-test-schema-root-wrapper.md) | Root `propTestSchema` identity wrapper | superseded by 0022 |
| [0022](./0022-typed-helper-subpaths.md) | Capability-scoped typed helper subpaths | accepted, amended by 0023 and 0034 |
| [0023](./0023-define-arbitraries-helper.md) | Name the PBT identity helper `defineArbitraries` | accepted |
| [0024](./0024-self-dogfooding-at-public-boundaries.md) | Self-dogfooding at public boundaries | accepted |
| [0025](./0025-report-the-first-failure-when-a-teardown-also-fails.md) | Report the first failure when a teardown also fails | accepted |
| [0026](./0026-refuse-callback-results-that-cannot-round-trip.md) | Refuse callback results that JSON cannot round-trip | accepted, amended by 0034 |
| [0027](./0027-identify-callbacks-by-object-then-source.md) | Identify callbacks by object, then by source text | accepted |
| [0028](./0028-scoped-npm-package-name.md) | Publish the wrapper as `@archont561/bun-test-utils` | accepted, amends 0013 |
| [0029](./0029-release-to-npm-and-github-packages.md) | Release from a tag on main to npm and GitHub Packages | accepted |
| [0030](./0030-headless-only-browser-testing.md) | Browser testing is headless-only; the browser fixture is Chromium-only | accepted, amended by 0032 |
| [0031](./0031-server-fixtures-pack.md) | Server fixtures pack: testServer, serverUrl, httpMock leave browser | accepted, amends 0013 |
| [0032](./0032-standard-playwright-install.md) | Browser binaries come from the standard Playwright install; retire the browsers branch | accepted, amends 0030, amended by 0033 |
| [0033](./0033-browser-ci-verification.md) | CI uses the shared browser installer and verifies both Chromium launch paths | accepted, amends 0032 |
| [0034](./0034-cassette-callback-serializers.md) | Cassette callback serializers: reversible, versioned, fixture-local | accepted, amends 0022 and 0026, amended by 0035 and 0040 |
| [0035](./0035-persist-callback-results-across-runs.md) | Persist cassette callback results across runs: sidecar, exact-source staleness, internal in 0.1.x | accepted, amends 0034 (point 8) |
| [0036](./0036-auto-cassette-mode-and-cache-clearing.md) | Auto cassette mode (record on first use, replay after) and explicit cache clearing for cassettes and snapshots | accepted |
| [0037](./0037-cli-workspace-and-prompts.md) | CLI as a private workspace bundled into the metapackage: citty commands, clack prompts for `cache clear`, project-root scoping, no config file in v1 | accepted |
| [0038](./0038-general-purpose-positioning-playwright-style-fixtures.md) | General-purpose test extension with Playwright-style fixtures; supersedes no record, retires the pytest framing from published copy | accepted |
| [0039](./0039-cassette-get-or-record-wrapper.md) | Callable cassette get-or-record wrapper with visible local refreshes | accepted; amends 0036 decision 4 for local callable callback misses only |
| [0040](./0040-global-callback-serializers.md) | Process-wide callback serializer registration for cassette preloads | accepted; amends 0034 points 3 and 5 |

Start from [`TEMPLATE.md`](./TEMPLATE.md).

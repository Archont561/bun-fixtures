# M5 — Publish to npm

- **Status:** 🟡 in progress
- **Specs:** [0005](../specs/0005-packaging-and-release.md)
- **Backlog task:** `task_005`

## Goal

`bun add -d @archont561/bun-test-utils && bunx test-utils init` works for a stranger. Exactly one npm
package is published; private workspaces are assembled into Bunup-built ESM and declarations per
[ADR 0014](../adr/0014-bunup-built-publication.md).

## Scope

- [x] CI runs lint, typecheck and tests on pushes and pull requests.
- [x] The pack smoke test verifies the one tarball's built JavaScript/declarations, licences and
      exports, installs it in a scratch project, runs the CLI, and executes the quickstart
      (`packages/bun-test-utils/e2e/pack.test.ts`).
- [x] The published package declares dual MIT OR Apache-2.0 licensing and includes both texts.
- [x] Release tooling is configured; private internal workspaces are excluded from publishing.
- [x] Package metadata and the `0.1.0` changelog are present.
- [x] Playwright-style testing API (`test.extend` and typed scenario chains) is landed and covered by tests (`task_021`).
- [x] Publication-readiness audit is complete (`task_016`).
- [x] Release stability tiers, flat fixture-key precedence, contractual error messages,
      and Linux/macOS support are defined (`task_041`, ADR 0018).
- [x] Pre-release documentation and README audit is complete (`task_089`).
- [ ] `v0.1.0` git tag.
- [ ] Publish `@archont561/bun-test-utils@0.1.0` (or configure trusted publishing).
- [ ] Re-run the installed-consumer harness against the registry package.

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Tarball contains built `dist`, README, both licences and manifest, with no source/private workspace trees | pack smoke test / `bun pm pack --dry-run` |
| 2 | Fresh install works from the tarball | pack smoke test |
| 3 | `bunx test-utils init` works from the installed package and writes the built preload path | pack smoke test and post-publish rerun |
| 4 | No `@bun-test-utils/*` internal workspace is published or referenced by public output | private manifests plus bundle/tarball audit |
| 5 | The Playwright-style `test.extend` and typed scenario-chain API is available before publication | task_021 tests and public export audit |

## Risks

| Risk | Mitigation |
|------|------------|
| Name `bun-test-utils` is unavailable on npm | Decided by ADR 0028: publish as `@archont561/bun-test-utils` (owner scope) |
| Built wrapper output drifts from private workspace source | Build every code workspace before packing; inspect and install the actual tarball in tests |
| Private package imports leak into public JavaScript or declarations | Bundle private workspaces and assert packed consumer imports/typechecks without workspace access |
| Global/`bunx` installation makes the default preload path wrong | Verify through the installed CLI harness; retain `--entry` as an escape hatch |
| Bun ships fixtures natively | Re-export the native capability and deprecate the internal engine |

# M5 — Publish to npm

- **Status:** 🟡 in progress
- **Specs:** [0005](../specs/0005-packaging-and-release.md)
- **Backlog task:** `task_005`

## Goal

`bun add -d bun-test-utils && bunx bun-test-utils init` works for a stranger. Exactly one npm
package is published; private workspaces are staged into it as raw-TypeScript subpaths per
[ADR 0013](../adr/0013-published-wrapper-internal-workspaces.md).

## Scope

- [x] CI runs lint, typecheck and tests on pushes and pull requests.
- [x] The pack smoke test verifies the one tarball's allowlisted wrapper/core/subpath sources,
      licences and exports, installs it in a scratch project, runs the CLI, and executes the
      quickstart (`packages/bun-test-utils/tests/e2e/pack.test.ts`).
- [x] The published package declares dual MIT OR Apache-2.0 licensing and includes both texts.
- [x] Release tooling is configured; private internal workspaces are excluded from publishing.
- [x] Package metadata and the `0.1.0` changelog are present.
- [ ] `v0.1.0` git tag.
- [ ] Publish `bun-test-utils@0.1.0` (or configure trusted publishing).
- [ ] Re-run the installed-consumer harness against the registry package.

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Tarball contains only wrapper source, staged internal source, README, both licences and manifest | pack smoke test / `bun pm pack --dry-run` |
| 2 | Fresh install works from the tarball | pack smoke test |
| 3 | `bunx bun-test-utils init` works from the installed package | pack smoke test and post-publish rerun |
| 4 | No `@bun-test-utils/*` internal workspace is published | private manifests plus tarball/publish audit |

## Risks

| Risk | Mitigation |
|------|------------|
| Name `bun-test-utils` is unavailable on npm | Check before tagging; fallback to an owner scope |
| Prepack source staging drifts from workspace source | Generate on every install and prepack; inspect and install the resulting tarball in tests |
| Global/`bunx` installation makes the default preload path wrong | Verify through the installed CLI harness; retain `--entry` as an escape hatch |
| Bun ships fixtures natively | Re-export the native capability and deprecate the internal engine |

# M5 — Publish to npm

- **Status:** ⬜ not started
- **Specs:** [0005](../specs/0005-packaging-and-release.md)
- **Backlog task:** `task_005`

## Goal

`bun add -d bun-fixture && bunx bun-fixture init` works for a stranger.

## Scope

- [ ] CI: `bun test` + `bunx tsc --noEmit` on push
- [ ] `bun pm pack` smoke test — install the tarball into a scratch project and run the quickstart
- [ ] LICENSE file (package.json already declares MIT)
- [ ] CHANGELOG + `v0.1.0` tag
- [ ] `npm publish --access public` (or trusted publishing from CI)
- [ ] Post-publish: re-run the e2e harness against the published package

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Tarball contains only `src/` + README + manifest | `bun pm pack --dry-run` |
| 2 | Fresh install works offline from the tarball | pack smoke test |
| 3 | `bunx bun-fixture init` works from the published package | manual run in a scratch dir |

## Risks

| Risk | Mitigation |
|------|------------|
| Name `bun-fixture` already taken on npm | Check before tagging; fallback scope `@<owner>/bun-fixture` |
| Global/`bunx` install makes the default preload path wrong | Detect installation layout in `init`, or document `--entry` |
| Bun ships fixtures natively | Re-export `test.extend` and deprecate — the engine is a thin wrapper |

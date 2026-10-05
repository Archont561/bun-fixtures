# M5 — Publish to npm

- **Status:** 🟡 in progress
- **Specs:** [0005](../specs/0005-packaging-and-release.md)
- **Backlog task:** `task_005`

## Goal

`bun add -d bun-fixture && bunx bun-fixture init` works for a stranger.

> **Scope has grown.** This milestone was written when `bun-fixture` was the only
> publishable package. There are now **six** (`bun-fixture`, `std`, `fast-check`,
> `dom`, `browser`, `vcr`), each with its own version line. Every item below
> applies to all six.

## Scope

- [x] CI: `bun run lint` + `bun run typecheck` + `bun run test` on push and PR
      (`.github/workflows/ci.yml`)
- [ ] `bun pm pack` smoke test — install the tarball into a scratch project and run the quickstart
- [x] LICENSE files — dual MIT / Apache-2.0 (`LICENSE`, `LICENSE-MIT`, `LICENSE-APACHE`
      at the root and in all six publishable packages; manifests declare
      `MIT OR Apache-2.0` and list both texts in `files`)
- [x] Release tooling: `@changesets/cli` configured for independent per-package
      versions, `access: public`, private packages excluded (`.changeset/config.json`)
- [x] Package metadata: `repository` (with `directory`), `homepage`, `bugs`,
      `author`, `keywords` and `publishConfig.access` on all six manifests
- [ ] CHANGELOG + `v0.1.0` tag (cut `0.1.0` *before* landing any changeset, or
      the first release becomes `0.1.1` — see `.changeset/README.md`)
- [ ] `bun run release:publish` for all six packages (or trusted publishing from CI)
- [ ] Post-publish: re-run the e2e harness against the published package

## Exit criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Tarball contains only `src/` + README + both licences + manifest | `bun pm pack --dry-run` |
| 2 | Fresh install works offline from the tarball | pack smoke test |
| 3 | `bunx bun-fixture init` works from the published package | manual run in a scratch dir |

## Risks

| Risk | Mitigation |
|------|------------|
| Name `bun-fixture` already taken on npm | Check before tagging; fallback scope `@<owner>/bun-fixture` |
| Global/`bunx` install makes the default preload path wrong | Detect installation layout in `init`, or document `--entry` |
| Bun ships fixtures natively | Re-export `test.extend` and deprecate — the engine is a thin wrapper |
| `workspace:` ranges in published `peerDependencies` | **Resolved.** `bun pm pack` does rewrite them — but `workspace:*` becomes an *exact* pin (`0.1.0`), which would break every plugin on the first `bun-fixture` patch release. The five plugins now use `workspace:^`, which packs as `^0.1.0`. Verified by extracting the tarball |
| Six packages publish out of order | A consumer installing `@bun-fixture/std` before `bun-fixture` exists on the registry gets an unresolvable peer. Publish `bun-fixture` first |

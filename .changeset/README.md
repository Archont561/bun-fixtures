# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
Each `.md` file here is one pending, unreleased change. They accumulate on `main`
and are consumed — and deleted — when versions are cut.

## Day to day

```bash
bun run changeset          # describe a change; writes .changeset/<name>.md — commit it
bun run release:version    # consume pending changesets: bump versions, write CHANGELOGs
bun run release:publish    # publish the bumped packages to npm and create git tags
```

You add a changeset in the **same pull request** as the change it describes. The
file is prose aimed at a user of the package, not a restatement of the commit
message — those two audiences want different things.

A change needs a changeset when it alters what a consumer sees: public API,
behaviour, types, dependencies, docs that ship in the tarball. Internal
refactors, CI tweaks, and `.backlog/` edits do not.

## How this repo is configured

As of the `bun-test-utils` rebrand and single-package consolidation (see the ADR
superseding ADR 0011, `task_018`/`task_020`), exactly **one** package ever publishes:
`bun-test-utils`. The six capability packages it bundles (`std`, `pbt`, `dom`, `browser`,
`vcr`, `snapshot`) are internal, unpublished (`private: true`) workspace packages nested
inside it — changesets ignores them automatically, the same way it already ignored
`@bun-test-utils/config` and `docs`.

| Setting | Value | Why |
|---------|-------|-----|
| `access` | `public` | `bun-test-utils` publishes to the public npm registry |
| `baseBranch` | `main` | changed-package detection diffs against `main` |
| `privatePackages` | not versioned or tagged | every `private: true` workspace package (`@bun-test-utils/config` and the six bundled internal packages) is skipped |
| `updateInternalDependencies` | `patch` | kept for workspace hygiene; with a single published package this mostly has nothing to do |
| `fixed` / `linked` | empty | only one package versions, so there is nothing left to fix or link |
| `commit` | `false` | lefthook runs commitlint, so commits stay hand-written and conventional |

## Before the first release

The package is still at an unpublished `0.1.0`. Changesets bumps *from* the current
version, so a changeset landed now would make the first-ever release `0.1.1` and skip
`0.1.0` entirely. Cut `0.1.0` first (M5 / `task_005`), then start accumulating changesets
for `0.1.1` and beyond.

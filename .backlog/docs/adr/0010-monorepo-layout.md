# 0010 — Monorepo layout

- **Status:** accepted

## Context

The repository had grown three kinds of content with different lifetimes and
audiences:

1. the publishable package (`src/`, `tests/`, `features/`);
2. project infrastructure — the Backlog board and the agent skills, which
   describe how *this repository* is worked on;
3. documentation about both.

All of it sat at the repository root, which made the package root and the
project root the same directory: `.backlog/`, `.claude/`, and `.agents/` were
one `files` mistake away from the npm tarball, and there was nowhere to put a
second package.

## Decision

Convert to a Bun workspace:

```
packages/bun-fixture/   the only publishable package
docs/ .backlog/ .agents/ .claude/ skills-lock.json   repository-level, root
package.json            private: true, workspaces: ["packages/*"]
```

The root `package.json` is private and depends on the workspace package via
`"bun-fixture": "workspace:*"` — without that dependency Bun resolves the
workspace but does not link `node_modules/bun-fixture`, and `import
"bun-fixture"` fails from the root.

`bun test` must work from the root *and* from the package, so each has a
`bunfig.toml`, and the Gherkin wiring resolves globs against `import.meta.dir`
instead of the cwd (`bunTestCucumber({ cwd })`, `loadFeatures(pattern, cwd)`).

## Consequences

**Good** — publishing is scoped to one directory that contains nothing else;
repository tooling (Backlog, skills, TypeScript) is a root dev dependency and
never reaches consumers; adding a second package (a Gherkin bridge, an eslint
plugin) is now a directory, not a refactor. The `@` alias keeps meaning "the
bun-fixture package root" from either cwd because the package tsconfig extends
the root one and overrides `paths`.

**Bad** — two `bunfig.toml`s and two `tsconfig.json`s to keep honest; paths in
docs and CI get one level deeper; a stray hoisted transitive dependency can
typecheck at the root and fail in the package (it already did — the
`@cucumber/messages` type import, now replaced with a structural type).

## Alternatives considered

- **Stay single-package** — simplest, but leaves `.backlog/` and `.claude/`
  inside the publishable root and caps the repo at one package.
- **Move only the infra into a `tools/` directory** — hides the problem; npm
  packaging still starts at the repository root.

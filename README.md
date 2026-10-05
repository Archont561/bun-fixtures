# bun-fixture — monorepo

Workspace root. The publishable code lives in
[`packages/bun-fixture`](./packages/bun-fixture); everything else here is
project infrastructure — docs, agent skills, and the Backlog board.

```
.
├── packages/
│   └── bun-fixture/          ← the only publishable package
│       ├── src/              plugin.ts · cli.ts · types.ts
│       ├── tests/            unit + Gherkin steps + harness
│       ├── features/         behavioural specs (*.feature)
│       ├── bunfig.toml       preload config for `cd packages/bun-fixture && bun test`
│       └── package.json      name: bun-fixture · deps: citty, smol-toml
├── docs/                     specs · milestones · ADRs · workflow
├── .backlog/                 Backlog project state (tasks, claims, runs)
├── .agents/skills/           agent skills, agent-agnostic layout
├── .claude/skills/           the same skills, Claude Code layout
├── skills-lock.json          pinned skill sources
├── bunfig.toml               preload config for `bun test` at the root
└── package.json              private workspace root — no publishing from here
```

## Quick start

```bash
bun install            # links packages/bun-fixture into ./node_modules
bun test               # every package: 37 unit + 131 behavioural steps
bun run test:unit      # dogfooding suite only
bun run test:bdd       # behavioural suite only
bun run typecheck      # tsc --noEmit in every workspace package
bun run status         # Backlog summary
bun run board          # Backlog kanban board
```

`bun test` works from the repository root **and** from inside the package —
both have a `bunfig.toml`, and the Gherkin wiring resolves its globs against
its own file rather than the cwd.

## Packages

| Package | Version | Description | Runtime deps |
|---------|---------|-------------|--------------|
| [`bun-fixture`](./packages/bun-fixture) | 0.1.0 (unpublished) | pytest-style scoped, injectable fixtures for `bun test` | [`citty`](https://github.com/unjs/citty) (CLI), [`smol-toml`](https://github.com/squirrelchat/smol-toml) (`bunfig.toml` edits) |

Its README is the product pitch — philosophy and API only. Everything
operational lives here and in [`docs/`](./docs): limits and non-goals in
[`docs/caveats.md`](./docs/caveats.md), rationale in [`docs/adr/`](./docs/adr),
the working loop in [`docs/workflow.md`](./docs/workflow.md).

The root `package.json` is `private: true`. Publishing happens from the package
directory, which is what `files` and `exports` are scoped to — see
[spec 0005](./docs/specs/0005-packaging-and-release.md).

## Testing

| Suite | Where | What it proves |
|-------|-------|----------------|
| unit / dogfooding | `packages/bun-fixture/tests/` | the engine's internals, in-process, using its own fixtures |
| behavioural (Gherkin) | `packages/bun-fixture/features/` + `tests/steps/` | what a user sees: a scratch project, a real `bun test` subprocess, its output and exit code |

Step definitions never import the engine, so the behavioural suite fails when
behaviour changes rather than when internals move — see
[spec 0006](./docs/specs/0006-behavioural-test-suite.md).

## Project infrastructure

| What | Where | Command |
|------|-------|---------|
| Specs, milestones, ADRs | [`docs/`](./docs) | — |
| Task board | `.backlog/` | `bunx backlog task list` |
| Agent skills (`tdd`, `refactor`, `skill-creator`) | `.agents/skills`, `.claude/skills` | `bunx skills list` |

Skills and Backlog live at the root on purpose: they describe how *this
repository* is worked on, not how the published package behaves, so they must
never end up in the npm tarball.

## The `@` alias

`@` resolves to the `bun-fixture` package root from either cwd — the root
`tsconfig.json` maps it to `./packages/bun-fixture/*`, the package's own
`tsconfig.json` (which extends the root) maps it to `./*`.

```ts
import { createTest } from "@";
import type { FixtureMap } from "@/src/types.ts";
```

## Docs

- [`docs/README.md`](./docs/README.md) — index and current state
- [`docs/workflow.md`](./docs/workflow.md) — claim → red → green → refactor → verify
- [`docs/specs/`](./docs/specs) · [`docs/milestones/`](./docs/milestones) · [`docs/adr/`](./docs/adr)

MIT

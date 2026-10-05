# bun-fixture — documentation

Working docs for the package. User-facing documentation lives in the
[root README](../README.md); everything here is for people building `bun-fixture`.

| Area | What lives there |
|------|------------------|
| [`specs/`](./specs) | Numbered specifications — what each component must do and how it is verified |
| [`milestones/`](./milestones) | M1–M5 delivery plan, status, and exit criteria |
| [`adr/`](./adr) | Architecture decision records — why the design is the way it is |
| [`workflow.md`](./workflow.md) | How backlog tasks, skills, and TDD fit together day to day |
| [`caveats.md`](./caveats.md) | Limits, trade-offs, and non-goals of the package |

## Current state

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| [M1](./milestones/M1-fixture-engine.md) | Fixture engine (scopes, teardown, params) + `createTest` | ✅ done |
| [M2](./milestones/M2-discovery.md) | Preload discovery + path-based merge | ✅ done |
| [M3](./milestones/M3-cli-init.md) | CLI `init` (TOML edit + scaffold) | ✅ done |
| [M4](./milestones/M4-types-docs-dogfooding.md) | Types, docs, dogfooding tests | ✅ done |
| [M5](./milestones/M5-publish.md) | Publish to npm | ⬜ not started |

Source of truth for task state is Backlog: `bunx backlog status` / `bunx backlog board`.

## Repository map

This is a Bun workspace ([ADR 0010](./adr/0010-monorepo-layout.md)): one
publishable package, with project infrastructure at the root.

```
packages/bun-fixture/
  src/plugin.ts      preload discovery + fixture engine + public API
  src/cli.ts         `bun-fixture init` (citty)
  src/types.ts       FixtureDef, Scope, FixtureContext, TestOptions
  tests/             dogfooding suite (fixtures.ts + nested/ prove the merge)
  tests/steps/       Gherkin step definitions + scratch-project harness
  features/          behavioural specs (*.feature)
  test-plugins.ts    preloads the Gherkin loader next to src/plugin.ts
  bunfig.toml        preload config when running from the package
docs/                this directory
bunfig.toml          preload config when running from the root
package.json         private workspace root
.agents/skills/      agent skills (refactor, tdd, skill-creator), agent-agnostic copies
.claude/skills/      same skills, Claude Code layout
.backlog/            Backlog project state (tasks, claims, runs)
```

> There is deliberately **no package-root `fixtures.ts`** — fixtures used by
> the suite live under `tests/`. Root-level discovery is still covered, by the
> end-to-end test and the behavioural suite, both of which scaffold throwaway
> projects in `tmpdir`.

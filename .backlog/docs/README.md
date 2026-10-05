# bun-fixture — documentation

Working docs for the package and its ecosystem. User-facing documentation lives in the
[root README](../../README.md) and individual package READMEs; everything here is for people building `bun-fixture`.

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
| [M5](./milestones/M5-publish.md) | Publish to npm | ⬜ ready |

Source of truth for task state is Backlog: `bunx backlog status` / `bunx backlog board`.

## Repository map

This is a Bun workspace ([ADR 0010](./adr/0010-monorepo-layout.md), [ADR 0011](./adr/0011-brand-identity-and-modular-ecosystem.md)):

```
packages/
  bun-fixture/       core engine, CLI (init), and public API
  std/               @bun-fixture/std (tmpdir, env, stdio)
  fast-check/        @bun-fixture/fast-check (property-based testing)
  dom/               @bun-fixture/dom (happy-dom in-memory component testing)
  browser/           @bun-fixture/browser (Playwright & Bun.serve fixtures)
  vcr/               @bun-fixture/vcr (HTTP record & replay cassette fixtures)
  config/            @bun-fixture/config (shared TypeScript configurations)
.backlog/            Backlog project state (tasks, claims, runs)
.backlog/docs/       this directory (specs, milestones, ADRs, workflow, caveats)
.agents/skills/      agent skills (refactor, tdd, skill-creator)
skills-lock.json     pinned skill sources
bunfig.toml          preload config when running from the root
package.json         private workspace root
tsconfig.json        root TypeScript configuration
turbo.json           Turborepo monorepo pipeline configuration
```

> There is deliberately **no package-root `fixtures.ts`** — fixtures used by
> the suite live under `tests/`. Root-level discovery is still covered, by the
> end-to-end test and the behavioural suite, both of which scaffold throwaway
> projects in `tmpdir`.

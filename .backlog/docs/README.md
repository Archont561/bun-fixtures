# bun-test-utils — documentation

Working docs for the package and its ecosystem. User-facing documentation lives in the
[root README](../../README.md) and individual package READMEs; everything here is for people building `bun-test-utils`.

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
| [M5](./milestones/M5-publish.md) | Publish to npm | 🟡 in progress |

Beyond the original M1–M5 plan, the ecosystem packages ([ADR 0013](./adr/0013-published-wrapper-internal-workspaces.md)) are
delivered but not all of them fully meet their acceptance criteria:

| Package | Spec | Task | Status |
|---------|------|------|--------|
| `@bun-test-utils/config` | [0008](./specs/0008-typescript-config-package.md) | `task_010` | ✅ done |
| `apps/docs` (Starlight) | [0007](./specs/0007-apps-docs-starlight.md) | `task_009` | ✅ done |
| `@bun-test-utils/std` | [0009](./specs/0009-standard-fixtures-std.md) | `task_011` | ✅ done |
| `@bun-test-utils/pbt` | [0010](./specs/0010-property-based-testing-fastcheck.md) | `task_012` | ✅ done |
| `@bun-test-utils/dom` · `@bun-test-utils/browser` | [0011](./specs/0011-dom-and-browser-fixtures.md) | `task_013` | 🟡 Playwright path untested |
| `@bun-test-utils/vcr` | [0012](./specs/0012-http-cassette-vcr.md) | `task_014` | ✅ done |

Source of truth for task state is Backlog: `bunx backlog status` / `bunx backlog board`.
Each 🟡 task carries the precise remaining gap in its description —
`bunx backlog task show <id>`.

## Repository map

This is a Bun workspace ([ADR 0010](./adr/0010-monorepo-layout.md), [ADR 0013](./adr/0013-published-wrapper-internal-workspaces.md)):

```
packages/
  bun-test-utils/     published wrapper and cross-cutting/E2E tests
  core/               @bun-test-utils/core (fixture engine, types, CLI internals)
  std/                @bun-test-utils/std (tmpdir, env, stdio)
  pbt/                @bun-test-utils/pbt (property-based testing)
  dom/               @bun-test-utils/dom (happy-dom in-memory component testing)
  browser/           @bun-test-utils/browser (Playwright & Bun.serve fixtures)
  vcr/               @bun-test-utils/vcr (HTTP record & replay cassette fixtures)
  snapshot/          @bun-test-utils/snapshot (value and file snapshots)
  bdd/               @bun-test-utils/bdd (Cucumber fixture bridge)
  config/            @bun-test-utils/config (shared TypeScript configurations)
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

# bun-test-utils — documentation

Working docs for the package and its internal capabilities. User-facing documentation lives in the
[root README](../../README.md) and the docs app; everything here is for people building `bun-test-utils`.

| Area | What lives there |
|------|------------------|
| [`specs/`](./specs) | Numbered specifications — what each component must do and how it is verified |
| [`milestones/`](./milestones) | M1–M10 delivery plan, status, and exit criteria |
| [`adr/`](./adr) | Architecture decision records — why the design is the way it is |
| [`audits/`](./audits) | Dated point-in-time reviews of the tree, with ranked findings |
| [`workflow.md`](./workflow.md) | How backlog tasks, skills, and TDD fit together day to day |
| [`caveats.md`](./caveats.md) | Limits, trade-offs, and non-goals of the package |

## Current state

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| [M1](./milestones/M1-fixture-engine.md) | Fixture engine (scopes, teardown, DI) + `createTest` | ✅ done |
| [M2](./milestones/M2-discovery.md) | Legacy preload discovery + path-based merge | superseded |
| [M3](./milestones/M3-cli-init.md) | CLI `init` (TOML edit) | ✅ done |
| [M4](./milestones/M4-types-docs-dogfooding.md) | Types, docs, dogfooding tests | ✅ done |
| [M5](./milestones/M5-publish.md) | Publish to npm | 🟡 in progress |
| [M6](./milestones/M6-developer-workflow.md) | Developer workflow and monorepo coverage | planned |
| [M7](./milestones/M7-contract-and-database.md) | API contract and database integration testing | planned |
| [M8](./milestones/M8-ui-regression.md) | UI regression and browser diagnostics | planned |
| [M9](./milestones/M9-local-observability.md) | Local test observability report | planned |
| [M10](./milestones/M10-mcp.md) | Read-only local MCP test server | planned |

Beyond the original M1–M5 plan, the internal capability packages ([ADR 0013](./adr/0013-published-wrapper-internal-workspaces.md)) are
delivered but remain implementation details behind the root `test` API:

| Package | Spec | Task | Status |
|---------|------|------|--------|
| `@bun-test-utils/config` | [0008](./specs/0008-typescript-config-package.md) | `task_010` | ✅ done |
| `apps/docs` (Starlight) | [0007](./specs/0007-apps-docs-starlight.md) | `task_009` | ✅ done |
| `@bun-test-utils/std` | [0009](./specs/0009-standard-fixtures-std.md) | `task_011`, `task_058` | ✅ done |
| `@bun-test-utils/pbt` | [0010](./specs/0010-property-based-testing-fastcheck.md) | `task_012`, `task_048` | ✅ done (`task_048` closed 2026-10-08 — its design-note-before-code criterion was waived, not met) |
| `@bun-test-utils/bdd` | [0014](./specs/0014-bdd-fixture-bridge.md) | `task_021`, `task_048` | ✅ done (`task_048` sequencing waiver recorded 2026-10-08; experimental) |
| `@bun-test-utils/dom` · `@bun-test-utils/browser` | [0011](./specs/0011-dom-and-browser-fixtures.md) | `task_013`, `task_058`, `task_072`, `task_073`, `task_075` | ✅ done — [PR #47 CI](https://github.com/Archont561/bun-test-utils/actions/runs/37994965762) verifies the shared installer, headless shell, isolated full-build Chromium fallback, and required Firefox launch proof (ADR 0033). Browser remains experimental, headless and Chromium-only |
| `@bun-test-utils/vcr` | [0012](./specs/0012-http-cassette-vcr.md) | `task_014`, `task_058`, `task_065`, `task_067`, `task_050`, `task_077`, `task_085`, `task_086`, `task_088` | ✅ done — callback serializers per [ADR 0034](./adr/0034-cassette-callback-serializers.md); callback results persist per test in a sidecar per [ADR 0035](./adr/0035-persist-callback-results-across-runs.md) (`task_085`); `auto` default mode and `test-utils cache clear` per [ADR 0036](./adr/0036-auto-cassette-mode-and-cache-clearing.md) (`task_086`); the machinery and conformance suites pin explicit cassette modes so a CI runner cannot trigger the auto-mode guard (`task_088`); installed-consumer `/vcr` preload proof in `packages/bun-test-utils/e2e/vcr-serializer.test.ts` |
| `@bun-test-utils/cli` | [0003](./specs/0003-cli-init.md) | `task_087` | ✅ done — citty commands, `@clack/prompts` confirmations and cache picker, cache planner, and project-root scoping per [ADR 0037](./adr/0037-cli-workspace-and-prompts.md); bundled into the metapackage, `test-utils` bin unchanged |

Source of truth for task state is Backlog: `bunx backlog status` / `bunx backlog board`.
Each 🟡 task carries the precise remaining gap in its description —
`bunx backlog task show <id>`.

## Repository map

This is a Bun workspace ([ADR 0010](./adr/0010-monorepo-layout.md), [ADR 0013](./adr/0013-published-wrapper-internal-workspaces.md)):

```
packages/
  bun-test-utils/     published wrapper and cross-cutting/E2E tests
  cli/                @bun-test-utils/cli (citty commands, clack prompts, cache planner)
  core/               @bun-test-utils/core (fixture engine, types)
  std/                @bun-test-utils/std (tmpdir, env, stdio)
  pbt/                @bun-test-utils/pbt (property-based testing)
  dom/               @bun-test-utils/dom (happy-dom in-memory component testing)
  browser/           @bun-test-utils/browser (Playwright browser and webPage fixtures)
  server/            @bun-test-utils/server (ephemeral Bun.serve and httpMock fixtures)
  vcr/               @bun-test-utils/vcr (HTTP record & replay cassette fixtures)
  snapshot/          @bun-test-utils/snapshot (value and file snapshots)
  bdd/               @bun-test-utils/bdd (internal BDD/scenario helpers)
  config/            @bun-test-utils/config (shared TypeScript and BDD configuration)
.backlog/            Backlog project state (tasks, claims, runs)
.backlog/docs/       this directory (specs, milestones, ADRs, workflow, caveats)
.agents/skills/      agent skills (session, tdd, refactor, grill-me, skill-creator, clean-code-principles, audit)
skills-lock.json     pinned skill sources
bunfig.toml          preload config when running from the root
package.json         private workspace root
tsconfig.json        root TypeScript configuration
turbo.json           Turborepo monorepo pipeline configuration
```

> Explicit composition only: `fixtures.ts` and `conftest.ts` are ordinary
> module names and are not automatically loaded. Tests import the runner from
> the root `@archont561/bun-test-utils` package and typed definition helpers from `/pbt` or `/bdd`.

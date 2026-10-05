# bun-fixture — monorepo

Workspace root for `bun-fixture` and its ecosystem of plugin packages.

```
.
├── packages/
│   ├── bun-fixture/          ← core engine & test runner
│   ├── std/                  ← @bun-fixture/std (tmpdir, env, stdio)
│   ├── fast-check/           ← @bun-fixture/fast-check (test.prop PBT)
│   ├── dom/                  ← @bun-fixture/dom (happy-dom component testing)
│   ├── browser/              ← @bun-fixture/browser (Playwright & Bun.serve)
│   ├── vcr/                  ← @bun-fixture/vcr (HTTP record & replay)
│   └── config/               ← @bun-fixture/config (shared tsconfigs)
├── .backlog/                 Backlog project state (tasks, claims, runs) & docs
│   └── docs/                 specs · milestones · ADRs · workflow · caveats
├── .agents/skills/           agent skills (refactor, skill-creator, tdd)
├── skills-lock.json          pinned skill sources
├── bunfig.toml               preload config for `bun test` at the root
├── tsconfig.json             root TypeScript configuration
├── turbo.json                Turborepo monorepo pipeline configuration
├── biome.json                Biome linter and formatter configuration
├── lefthook.yml              Git hooks configuration
└── package.json              private workspace root — no publishing from here
```

## Quick start

```bash
bun install            # links workspace packages into ./node_modules
bun test               # runs unit, behavioural, and plugin test suites
bun run test:unit      # dogfooding suite only
bun run test:bdd       # behavioural suite only
bun run typecheck      # tsc --noEmit in every workspace package
bun run status         # Backlog summary
bun run board          # Backlog kanban board
```

## Packages

| Package | Version | Description | Runtime deps |
|---------|---------|-------------|--------------|
| [`bun-fixture`](./packages/bun-fixture) | 0.1.0 | pytest-style scoped, injectable fixtures for `bun test` | [`citty`](https://github.com/unjs/citty), [`smol-toml`](https://github.com/squirrelchat/smol-toml) |
| [`@bun-fixture/std`](./packages/std) | 0.1.0 | Standard zero-dependency built-in fixtures (`tmpdir`, `env`, `stdio`) | — |
| [`@bun-fixture/fast-check`](./packages/fast-check) | 0.1.0 | Property-Based Testing (`test.prop`) with fixture DI | [`fast-check`](https://github.com/dubzzz/fast-check) |
| [`@bun-fixture/dom`](./packages/dom) | 0.1.0 | In-memory DOM simulation and component testing | [`happy-dom`](https://github.com/capricorn86/happy-dom) |
| [`@bun-fixture/browser`](./packages/browser) | 0.1.0 | Headless browser (Playwright) and ephemeral `Bun.serve` server fixtures | `playwright` (optional) |
| [`@bun-fixture/vcr`](./packages/vcr) | 0.1.0 | HTTP Cassette / VCR network record & replay fixture | — |
| [`@bun-fixture/config`](./packages/config) | 0.1.0 (private) | Shared monorepo TypeScript configurations | — |

The root `package.json` is `private: true`. Publishing happens from individual package directories. Operational docs live in [`.backlog/docs/`](./.backlog/docs): limits in [`.backlog/docs/caveats.md`](./.backlog/docs/caveats.md), architecture rationale in [`.backlog/docs/adr/`](./.backlog/docs/adr), and the working loop in [`.backlog/docs/workflow.md`](./.backlog/docs/workflow.md).

## Testing

| Suite | Where | What it proves |
|-------|-------|----------------|
| unit / dogfooding | `packages/bun-fixture/tests/` | core engine internals, in-process, using its own fixtures |
| behavioural (Gherkin) | `packages/bun-fixture/features/` + `tests/steps/` | user-visible behaviour in real scratch projects |
| plugin suites | `packages/*/tests/` | plugin capabilities (`@bun-fixture/std`, `@bun-fixture/fast-check`, etc.) |

## Project infrastructure

| What | Where | Command |
|------|-------|---------|
| Specs, milestones, ADRs | [`.backlog/docs/`](./.backlog/docs) | — |
| Task board | `.backlog/` | `bunx backlog task list` |
| Agent skills (`tdd`, `refactor`, `skill-creator`) | `.agents/skills` | `bunx skills list` |

## The `@` alias

`@` resolves to the `bun-fixture` package root from either cwd — the root
`tsconfig.json` maps it to `./packages/bun-fixture/src/plugin.ts` (and `@/*` to `./packages/bun-fixture/*`), the package's own
`tsconfig.json` (which extends `@bun-fixture/config/lib.json`) maps it to `./src/plugin.ts` (and `@/*` to `./*`).

```ts
import { createTest } from "@";
import type { FixtureMap } from "@/src/types.ts";
```

## Docs

- [`.backlog/docs/README.md`](./.backlog/docs/README.md) — index and current state
- [`.backlog/docs/workflow.md`](./.backlog/docs/workflow.md) — claim → red → green → refactor → verify
- [`.backlog/docs/specs/`](./.backlog/docs/specs) · [`.backlog/docs/milestones/`](./.backlog/docs/milestones) · [`.backlog/docs/adr/`](./.backlog/docs/adr)

MIT

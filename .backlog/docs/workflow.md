# Working on bun-test-utils

## Tooling

| Tool | Command | Use |
|------|---------|-----|
| Backlog | `bunx backlog status`, `bunx backlog board` | tasks, claims, orchestration (`.backlog/`) |
| Skills | `bunx skills list` | agent skills installed into `.agents/skills` |
| Bun | `bun test`, `bun run typecheck` | the only build/test toolchain — no compile step |
| Cucumber | `bun run test:bdd` | package-owned behavioural suites: `packages/*/e2e/bdd/features/*.feature`, each run by a one-line `packages/*/e2e/bdd/features.test.ts` ([ADR 0017](./adr/0017-shared-bdd-runner-helper.md)) |

## Installed skills

| Skill | Source | When it applies |
|-------|--------|-----------------|
| `session` | repo-local | start and end of a work session — bootstrap, survey, propose, report |
| `tdd` | `mattpocock/skills` | any behaviour change — write the failing test first |
| `refactor` | `github/awesome-copilot` | structural change with no behaviour change |
| `grill-me` | `mattpocock/skills` | sharpening a plan or design before committing to it |
| `skill-creator` | `anthropics/skills` | authoring a new skill for this repo |

Skills are installed with `--copy`, so the files are real and committed rather
than symlinked into `node_modules` (which is gitignored and not portable).
`session` is authored here rather than vendored, so it carries no
`skills-lock.json` entry — it encodes this repository's own commands and
sandbox quirks, adapted from the same skill in
[`Archont561/pixi-sandbox`](https://github.com/Archont561/pixi-sandbox).

> `bunx skills add` writes ~50 agent directories (`.claude/`, `.qwen/`,
> `.windsurf/`, …) plus `agent/`, `data/` and `skills/` at the repository root.
> Only `.agents/skills/` is kept here — delete the rest before committing.

## Where things live

The repository is a Bun workspace. Focused implementation and mirrored tests live in the
private `packages/*` workspaces; `packages/bun-test-utils` is the published wrapper and owns
cross-cutting conformance and end-to-end tests. Backlog, skills, and docs are at the root
(docs in `.backlog/docs`). `bun test` and `bun run typecheck` work from the root or a package.

## Loop

1. **Pick** a task: `bunx backlog task list`, then `bunx backlog task show <id>`.
2. **Claim** it: `bunx backlog claim` (claims are enforced on commit).
3. **Red** — add a failing test. User-visible behaviour goes in the owning package's
   `e2e/bdd/features/*.feature` suite (`bun run test:bdd`). Focused internals go in that
   workspace's `tests/<source>.test.ts`; cross-package composition goes in
   `packages/bun-test-utils/tests/conformance/`, and installed-consumer behaviour in
   `packages/bun-test-utils/e2e/`.
4. **Green** — minimum change in `src/`.
5. **Refactor** — apply the `refactor` skill; tests must stay green.
6. **Verify** — `bun test && bun run typecheck`. Both are the definition of done.
7. **Move** the task: `bunx backlog task move <id> done`.

## Definition of done

- `bun test` green from the repository root, including the behavioural suite.
- `bun run typecheck` clean in every workspace package.
- Public API change → README updated **and** the matching spec in `.backlog/docs/specs/`.
- Design change → a new ADR in `.backlog/docs/adr/`, with the superseded one marked.

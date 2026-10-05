# Working on bun-fixture

## Tooling

| Tool | Command | Use |
|------|---------|-----|
| Backlog | `bunx backlog status`, `bunx backlog board` | tasks, claims, orchestration (`.backlog/`) |
| Skills | `bunx skills list` | agent skills installed into `.agents/skills` |
| Bun | `bun test`, `bun run typecheck` | the only build/test toolchain — no compile step |
| Cucumber | `bun run test:bdd` | behavioural suite: `packages/bun-fixture/features/*.feature` + `packages/bun-fixture/tests/steps/` |

## Installed skills

| Skill | Source | When it applies |
|-------|--------|-----------------|
| `tdd` | `mattpocock/skills` | any behaviour change — write the failing test first |
| `refactor` | `github/awesome-copilot` | structural change with no behaviour change |
| `skill-creator` | `anthropics/skills` | authoring a new skill for this repo |

Skills are installed with `--copy`, so the files are real and committed rather
than symlinked into `node_modules` (which is gitignored and not portable).

## Where things live

The repository is a Bun workspace. Package code and its tests are in
`packages/bun-fixture`; Backlog, skills, and docs are at the root (docs in
`.backlog/docs`). `bun test` and `bun run typecheck` work from either place.

## Loop

1. **Pick** a task: `bunx backlog task list`, then `bunx backlog task show <id>`.
2. **Claim** it: `bunx backlog claim` (claims are enforced on commit).
3. **Red** — add a failing test. User-visible behaviour goes in
   `features/*.feature` (`bun run test:bdd`); internals go in
   `tests/fixtures.test.ts` (`bun run test:unit`), which dogfoods the engine
   through its own fixtures.
4. **Green** — minimum change in `src/`.
5. **Refactor** — apply the `refactor` skill; tests must stay green.
6. **Verify** — `bun test && bun run typecheck`. Both are the definition of done.
7. **Move** the task: `bunx backlog task move <id> done`.

## Definition of done

- `bun test` green from the repository root, including the behavioural suite.
- `bun run typecheck` clean in every workspace package.
- Public API change → README updated **and** the matching spec in `.backlog/docs/specs/`.
- Design change → a new ADR in `.backlog/docs/adr/`, with the superseded one marked.

# 0003 — CLI `init`

- **Status:** implemented
- **Milestone:** M3
- **Implementation:** `packages/cli/src/{commands,init,prompts}.ts`, `packages/bun-test-utils/src/cli.ts`
- **Tests:** `packages/cli/tests/{init,commands,prompts}.test.ts` (focused behavior) and `packages/bun-test-utils/e2e/` (installed behavior)

## Problem

Wiring up the preload by hand is easy to get wrong — notably, Bun rejects a
bare `node_modules/...` preload path and needs `./node_modules/...`.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `test-utils init` MUST read or create `bunfig.toml` and append the preload entry to `[test].preload` |
| R2 | The default entry MUST be `./node_modules/@archont561/bun-test-utils/dist/plugin.js` |
| R3 | It MUST be idempotent — a second run MUST NOT duplicate the entry |
| R4 | An existing string `preload` MUST be normalized to a list, preserving the original value |
| R5 | Unrelated `bunfig.toml` sections MUST survive the round-trip |
| R6 | It MUST NOT scaffold fixture files; projects compose fixtures explicitly with `test.extend()` |
| R7 | Options `--dir`, `--entry`, `--force`, `--yes`, `--help`, `--version` MUST be supported, with generated help; `--force` is retained for compatibility and does not overwrite project files; in a TTY without `--yes` or `CI`, `init` confirms before writing `bunfig.toml` ([ADR 0037](../adr/0037-cli-workspace-and-prompts.md)) |
| R8 | Loss of TOML comments MUST be warned about when the original file had any |

## Design

The command tree is built with citty (see [ADR 0009](../adr/0009-citty-for-the-cli.md) and [ADR 0037](../adr/0037-cli-workspace-and-prompts.md)):
`initCommand` declares typed args (`--dir`, `--entry`, `--force`, `--yes`) with defaults,
and help/version output is generated. The command body is the exported `init()`
function, so it can be called directly or through `runInitCommand` in tests.

`smol-toml` parses and re-stringifies; regex editing of TOML is too fragile.
`addPreload(text, entry)` is pure — it returns `{ text, changed }` — which makes
the TOML behaviour unit-testable without touching the filesystem.

## Out of scope

Removing the entry (`uninit`); editing a global/user-level `bunfig.toml`;
preserving comments (see ADR 0004).

## Verification

| Requirement | Test |
|-------------|------|
| R1, R2 | "adds the preload entry to an empty bunfig", "`init` initializes a project end to end" |
| R3, R5 | "preserves existing config and is idempotent" |
| R4 | "normalizes a string preload into a list" |
| R7 | "parses arguments with citty", `features/cli-init.feature` |
| R1–R6 | "a fresh project: init → preload → run → teardown", `features/cli-init.feature` |

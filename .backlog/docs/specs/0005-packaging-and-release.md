# 0005 — Packaging and release

- **Status:** draft
- **Milestone:** M5
- **Implementation:** `packages/bun-fixture/package.json`

## Requirements

| # | Requirement |
|---|-------------|
| R1 | The package MUST ship raw TypeScript — no build step (Bun runs `.ts` directly) |
| R2 | `files` MUST contain exactly `src` and `README.md` |
| R3 | `exports` MUST expose `.`, `./plugin`, `./types`, `./package.json` |
| R4 | `bin.bun-fixture` MUST point at `./src/cli.ts` with a `#!/usr/bin/env bun` shebang |
| R5 | `engines.bun` MUST state the minimum supported Bun |
| R6 | Publishing MUST be blocked unless `bun test` and `tsc --noEmit` pass |
| R7 | A smoke test MUST install the packed tarball into a scratch project and run the quickstart |
| R8 | Releases MUST be tagged `v<version>` with a CHANGELOG entry |
| R9 | Publishing MUST happen from `packages/bun-fixture`; the workspace root is `private` and MUST never be published |
| R10 | The tarball MUST NOT contain repository infrastructure (`.backlog/`, `.agents/`, `.claude/`, `docs/`) |

## Open questions

- Does `bun publish` from a workspace rewrite `workspace:*` ranges correctly?
  (The package has no workspace dependencies today, so this is latent.)

- Dual-publish a JS build for Node-based runners, or stay Bun-only?
- Provenance / npm trusted publishing from CI?
- Does `bunx bun-fixture init` work from a *global* install, where the default
  `./node_modules/...` entry does not exist? (Likely needs entry detection.)

## Verification

`bun pm pack` → install the tarball in `tmpdir` → `bunx bun-fixture init` →
`bun test` must pass, reusing the harness of the existing end-to-end test.

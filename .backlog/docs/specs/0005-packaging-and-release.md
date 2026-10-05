# 0005 — Packaging and release

- **Status:** draft
- **Milestone:** M5
- **Implementation:** `packages/bun-fixture/package.json`

## Requirements

| # | Requirement |
|---|-------------|
| R1 | The package MUST ship raw TypeScript — no build step (Bun runs `.ts` directly) |
| R2 | `files` MUST contain exactly `src`, `README.md`, `LICENSE-MIT` and `LICENSE-APACHE` |
| R3 | `exports` MUST expose `.`, `./plugin`, `./types`, `./package.json` |
| R4 | `bin.bun-fixture` MUST point at `./src/cli.ts` with a `#!/usr/bin/env bun` shebang |
| R5 | `engines.bun` MUST state the minimum supported Bun |
| R6 | Publishing MUST be blocked unless `bun test` and `tsc --noEmit` pass |
| R7 | A smoke test MUST install the packed tarball into a scratch project and run the quickstart |
| R8 | Releases MUST be tagged `v<version>` with a CHANGELOG entry |
| R9 | Publishing MUST happen from `packages/bun-fixture`; the workspace root is `private` and MUST never be published |
| R10 | The tarball MUST NOT contain repository infrastructure (`.backlog/`, `.agents/`, `.claude/`, `docs/`) |
| R11 | Every publishable package MUST declare `"license": "MIT OR Apache-2.0"` and ship both licence texts |

### Why the licence files are listed in `files` (R2)

`bun pm pack` only ever force-includes the *extensionless* names
`package.json`, `README`, `LICENSE` and `LICENCE`. Unlike `npm pack`, it does
**not** honour suffixed variants such as `LICENSE-MIT` once a `files` array is
present — see [oven-sh/bun#18679](https://github.com/oven-sh/bun/issues/18679).
Because this project dual-licenses, both texts must be named explicitly in
`files` or they are silently dropped from the tarball, shipping a package whose
manifest promises two licences and whose contents carry neither.

## Open questions

- ~~Does `bun publish` from a workspace rewrite `workspace:*` ranges correctly?~~
  **Answered.** `bun pm pack` (1.4.2) rewrites workspace protocol ranges in the
  packed manifest, including inside `peerDependencies`. The subtlety is *which*
  range: `workspace:*` packs as an exact pin (`"bun-fixture": "0.1.0"`), so any
  later `bun-fixture` patch would violate the peer constraint of every plugin.
  The five plugin packages therefore declare `workspace:^`, which packs as
  `"^0.1.0"`. Verified by extracting the tarball, not by reading docs.

- Dual-publish a JS build for Node-based runners, or stay Bun-only?
- Provenance / npm trusted publishing from CI?
- Does `bunx bun-fixture init` work from a *global* install, where the default
  `./node_modules/...` entry does not exist? (Likely needs entry detection.)

## Verification

`bun pm pack` → install the tarball in `tmpdir` → `bunx bun-fixture init` →
`bun test` must pass, reusing the harness of the existing end-to-end test.

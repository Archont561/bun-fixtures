# 0005 — Packaging and release

- **Status:** in progress
- **Milestone:** M5
- **Implementation:** `packages/bun-test-utils/package.json`
- **Architecture:** [ADR 0013](../adr/0013-published-wrapper-internal-workspaces.md)

## Requirements

| # | Requirement |
|---|-------------|
| R1 | The package MUST ship raw TypeScript — no build step (Bun runs `.ts` directly) |
| R2 | The tarball MUST contain the public wrapper `src/`, staged internal `core/src` and capability `<subpath>/src` trees, `README.md`, `LICENSE-MIT` and `LICENSE-APACHE` |
| R3 | `exports` MUST expose `.`, `./plugin`, `./types`, every supported capability subpath, and `./package.json` |
| R4 | `bin.bun-test-utils` MUST point at `./src/cli.ts` with a `#!/usr/bin/env bun` shebang |
| R5 | `engines.bun` MUST state the minimum supported Bun |
| R6 | Publishing MUST be blocked unless `bun test` and `tsc --noEmit` pass |
| R7 | A smoke test MUST install the packed tarball into a scratch project and run the quickstart |
| R8 | Releases MUST be tagged `v<version>` with a CHANGELOG entry |
| R9 | Publishing MUST happen from `packages/bun-test-utils`; every sibling workspace and the repository root are private and MUST never be published |
| R10 | The tarball MUST NOT contain repository infrastructure, focused internal tests, workspace manifests, or generated caches |
| R11 | The published package MUST declare `"license": "MIT OR Apache-2.0"` and ship both licence texts |
| R12 | Packing MUST stage canonical internal workspace sources into the wrapper without committing duplicate source trees |

### Why the licence files are listed in `files`

`bun pm pack` only force-includes extensionless names such as `LICENSE`. Unlike `npm pack`, it
does not reliably include suffixed variants such as `LICENSE-MIT` once a `files` array is
present (see [oven-sh/bun#18679](https://github.com/oven-sh/bun/issues/18679)). Both texts are
therefore named explicitly.

### Source staging

Normal workspace installs stage symlinks from `packages/bun-test-utils/<name>/src` to each
canonical sibling workspace. This ensures public subpath imports and focused internal tests load
the same module instance. `prepack` replaces links with source copies so the tarball is
self-contained; `postpack` restores links. The pack smoke test inspects and installs the actual
tarball rather than trusting source manifests.

## Verification

`packages/bun-test-utils/tests/e2e/pack.test.ts` runs `bun pm pack`, verifies the allowlisted
contents and exports, installs the tarball into a scratch project, runs `bun-test-utils init`,
and executes a quickstart that imports both the core API and a bundled subpath.

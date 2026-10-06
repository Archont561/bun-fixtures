# 0005 — Packaging and release

- **Status:** in progress
- **Milestone:** M5
- **Implementation:** `packages/bun-test-utils/package.json`
- **Architecture:** [ADR 0014](../adr/0014-bunup-built-publication.md)

## Requirements

| # | Requirement |
|---|-------------|
| R1 | Every code workspace MUST build Bun-targeted ESM and TypeScript declarations into `dist/` with Bunup. |
| R2 | Code workspaces MUST consume the typed shared `createBunupConfig()` factory through a local `bunup.config.ts`. |
| R3 | The public tarball MUST contain built `dist/`, `README.md`, `LICENSE-MIT`, `LICENSE-APACHE`, and package metadata; it MUST NOT contain `src/` or private workspace trees. |
| R4 | `exports` MUST expose `.`, `./plugin`, `./types`, every supported capability subpath, and `./package.json` through built JavaScript and declarations. |
| R5 | `bin.bun-test-utils` MUST point at `./dist/cli.js`, which retains the `#!/usr/bin/env bun` shebang. |
| R6 | `engines.bun` MUST state the minimum supported Bun. |
| R7 | Publishing MUST be blocked unless frozen install, build, lint, typecheck, tests, docs build, and packed-consumer checks pass. |
| R8 | A smoke test MUST install the packed tarball into a scratch project, run the CLI, and execute the quickstart. |
| R9 | Releases MUST be tagged `v<version>` and described by the consumed Changeset and GitHub release notes; per-package CHANGELOG files MUST NOT be generated. |
| R10 | Publishing MUST happen from `packages/bun-test-utils`; every sibling workspace and the repository root are private and MUST never be published. |
| R11 | The published package MUST declare `"license": "MIT OR Apache-2.0"` and ship both licence texts. |
| R12 | Private workspace implementations MUST be bundled into the public entries; optional public peers (`playwright`, `happy-dom`, and `fast-check`) MUST remain external. |

### Why the licence files are listed in `files`

`bun pm pack` only force-includes extensionless names such as `LICENSE`. Unlike `npm pack`, it
does not reliably include suffixed variants such as `LICENSE-MIT` once a `files` array is
present (see [oven-sh/bun#18679](https://github.com/oven-sh/bun/issues/18679)). Both texts are
therefore named explicitly.

### Build and development staging

Normal workspace installs stage source symlinks under `packages/bun-test-utils/` for focused
development and composition tests. They are not publication inputs. Bunup builds each private
workspace and then assembles the public root, CLI, types, and capability entries in `dist/`.
`prepack` rebuilds the wrapper; the `files` allowlist publishes only built artifacts and project
documentation.

The public declaration build resolves private workspace types from repository-root context and
bundles them, so no declaration in the tarball imports an unpublished `@bun-test-utils/*`
package. Runtime builds likewise bundle private workspaces while preserving third-party imports.

## Verification

`packages/bun-test-utils/e2e/pack.test.ts` runs `bun pm pack`, verifies the built allowlist
and export map, rejects source/private-workspace leakage, installs the tarball into a scratch
project, runs `bun-test-utils init`, and executes a quickstart using the core API and a capability
subpath.

# 0014 — Publish Bunup-built ESM and declarations

- **Status:** accepted
- **Supersedes:** [0003](./0003-raw-ts-distribution.md) and the publication mechanics in [0013](./0013-published-wrapper-internal-workspaces.md)

## Context

Publishing raw workspace sources made the npm artifact depend on Bun's TypeScript loader and on a
prepack copy of every private workspace. That copy step duplicated implementation trees inside the
public wrapper, made the allowlist difficult to audit, and exposed repository layout through the
package contract.

The repository still needs one public `bun-test-utils` package while retaining private workspaces
for core and each capability.

## Decision

Every code workspace uses a local `bunup.config.ts` backed by the typed
`createBunupConfig()` factory exported from `@bun-test-utils/config/bunup`. Builds emit Bun-targeted
ESM and TypeScript declarations to `dist/`, use a common `src` source base, clean before emitting,
and leave third-party packages external.

The public wrapper bundles all private `@bun-test-utils/*` implementations into stable root and
capability entrypoints. Its manifest exports only `dist/*.js` and `dist/*.d.ts`; the CLI points to
`dist/cli.js`. The npm tarball contains `dist`, the README, both licence texts, and package
metadata—never workspace sources. Optional public peers such as Playwright, Happy DOM, and
fast-check remain external.

Source symlinks staged in the wrapper are development conveniences only. Packing runs the build
and does not copy or publish them.

## Consequences

**Good:** consumers receive conventional ESM and declarations; the tarball no longer exposes or
duplicates private sources; public paths are independent of workspace layout; and every code
package has the same reproducible build contract.

**Bad:** publishing and local preparation now require Bunup; generated output can be stale until a
build runs; and the wrapper's declaration build needs repository-root context so private workspace
types can be bundled without leaking private package imports.

## Alternatives considered

- **Continue publishing raw TypeScript:** smallest toolchain, but preserves source staging and a
  Bun-loader-specific package artifact.
- **Publish every workspace:** simplifies package-level builds but creates version skew and breaks
  the single-package product contract.
- **Ship wrapper declarations that reference private packages:** smaller output, but consumers
  cannot resolve unpublished `@bun-test-utils/*` packages.

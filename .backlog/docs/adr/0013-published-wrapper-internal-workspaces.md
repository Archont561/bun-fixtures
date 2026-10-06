# 0013 — Published wrapper over internal workspaces

- **Status:** partially superseded by [0014](./0014-bunup-built-publication.md)
- **Supersedes:** [0011](./0011-brand-identity-and-modular-ecosystem.md)

## Context

The repository publishes one npm package, `bun-test-utils`, while maintaining distinct
capabilities as private workspaces. After those workspaces were flattened under `packages/`,
the publishable package still owned the fixture engine implementation and its focused unit
tests. That made it both an implementation package and the assembly boundary, unlike every
other capability, and mixed package-local tests with cross-capability conformance tests.

The source layout also used broad test filenames such as `std.test.ts` and `vcr.test.ts`, which
stopped reflecting the implementation files as packages gained more than one source module.

## Decision

`packages/bun-test-utils` is the public assembly wrapper. It owns the npm manifest, public
entrypoint adapters, CLI adapter, licences and README. Its tests cover only the assembled
product: subpath composition, behavioural scratch projects, the installed CLI, tarball contents
and consumer quickstarts.

The fixture engine, type definitions and CLI internals live in the private
`packages/core` workspace as `@bun-test-utils/core`. All capabilities, including core, are
siblings under `packages/` and remain unpublished.

Before normal workspace use, the wrapper stages each internal `src/` as a symlink so public
subpath imports resolve to the canonical workspace source and Bun loads one engine instance.
Before `bun pm pack`, `prepack` replaces those symlinks with source copies; `postpack` restores
the development links. The resulting tarball remains one self-contained raw-TypeScript package.

Every internal package uses parallel `src/` and `tests/` directories. A test file mirrors the
source module it primarily verifies: for example, `src/cassette.ts` has
`tests/cassette.test.ts`, and `src/env.ts` has `tests/env.test.ts`. Test-only fixture and support
files may sit beside those mirrored tests.

## Consequences

**Good:** the npm package is a thin, auditable assembly boundary; focused tests live with their
implementation; cross-package failures have one obvious home; internal source can be reorganized
without changing public import paths; test filenames reveal coverage gaps.

**Bad:** local public imports depend on the staging step run by `bun install`; packing has a
prepack/postpack filesystem transition; direct edits under generated
`packages/bun-test-utils/<subpath>/` directories are discarded. CI and contributors must use the
locked install before running tests.

## Alternatives considered

- **Keep core in the public wrapper:** fewer staging concerns, but preserves the asymmetric
  package and mixed test responsibilities this decision is intended to remove.
- **Publish every workspace independently:** avoids staging but reintroduces version skew and
  multiple install targets, contrary to the single-package product decision.
- **Commit duplicated bundled sources:** makes packing simple but creates two editable copies of
  every implementation and invites drift.

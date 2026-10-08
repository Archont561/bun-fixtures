# 0023 — Name the PBT identity helper `defineArbitraries`

- **Status:** accepted
- **Date:** 2026-10-08
- **Amends:** [0022](./0022-typed-helper-subpaths.md), PBT helper naming only

## Context

ADR 0022 placed the PBT identity wrapper at `bun-test-utils/pbt` as
`propTestSchema`. The name can suggest runtime validation, and it repeats the
property-testing context already supplied by the subpath. The helper instead
provides contextual typing for a record of fast-check arbitraries or a factory
that returns one, then returns that definition unchanged.

## Decision

Name the helper `defineArbitraries` and export it from `bun-test-utils/pbt`.
Do not export `propTestSchema` as a compatibility alias; the package is not yet
released, and the requested API is a strict move with a single canonical name.

This is a naming-only change. The helper's overloads, inference, identity
semantics, type aliases, package subpaths, root API, fixture autodetection,
composition behavior, optional-peer behavior, and release timing are unchanged.

## Consequences

**Good**

- The name describes the fast-check arbitrary record being authored without
  implying validation or parsing.
- The subpath avoids a redundant `prop` qualifier.
- There is one discoverable public helper name rather than a canonical name
  plus an alias.

**Trade-off**

- Documentation and shared schemas must use `defineArbitraries`; callers of the
  earlier pre-release name must update their imports.

## Alternatives considered

- Keep `propTestSchema`: rejected because "schema" suggests validation and
  "prop" repeats the `/pbt` context.
- Use `arbitraries`: shorter, but less explicit that this function marks a
  typed definition boundary.
- Export both names: rejected to keep the unreleased API narrow and the move
  strict.

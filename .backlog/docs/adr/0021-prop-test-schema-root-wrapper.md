# 0021 — Root `propTestSchema` identity wrapper

- **Status:** accepted
- **Date:** 2026-10-08

## Context

Task_048 initially chose type-only exports plus consumer convention: shared
factories imported `FastCheckApi` to type their fast-check parameter. The user
later requested a top-level `propTestSchema` helper so shared schema factories
can receive contextual typing without importing that type in each schema file.
This amends the previously pinned root runtime-value lists in ADR 0012 and
ADR 0013, without changing their no-capability-subpath decisions, and
supersedes the initial task_048 choice.

## Decision

Export exactly one additional named runtime value from `bun-test-utils`:
`propTestSchema`. It is an identity wrapper accepting either an arbitrary
record or a factory `(fc: FastCheckApi) => record`. Its generic signature
preserves the schema's arbitrary types, and a factory's `fc` parameter is
contextually typed. The helper returns the supplied value unchanged; property
execution remains on `test.prop` and `test.scenario.prop`.

The root runtime surface is now `describe`, `expect`, `propTestSchema`, and
`test`. No `test.schema` member, schema registry, global lookup, capability
subpath, or additional runtime helper is introduced. Type-only aliases remain
available for consumers that need them.

This API change does not alter the release decision: keep it out of `0.1.0` and
do not publish until the separately authorized release task.

## Consequences

**Good**

- Shared schema modules get typed factories without repeating or importing
  `FastCheckApi` at each schema declaration.
- The identity semantics keep composition plain: consumers still use
  object spread and explicit imports.
- The helper has no dependency on fast-check at runtime and adds no PBT
  execution mechanism.

**Bad**

- This adds a stable named root runtime export and updates the conformance
  contract; the helper must be treated as public API.
- It is a small no-op wrapper. Consumers who prefer direct annotations may
  continue to use the type-only `FastCheckApi` alias.
- Published declarations still reference fast-check's types; strict consumers
  without that optional peer retain the documented `skipLibCheck` tradeoff.

## Alternatives considered

- Keep the original type-only convention and ask every shared schema module to
  import `FastCheckApi`.
- Let each consumer write its own identity wrapper, avoiding any package API
  change but duplicating that convention.
- Add a `test.schema` member or a registry; rejected because neither is needed
  for contextual typing or composition.

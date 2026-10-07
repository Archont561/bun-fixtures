# 0022 — Capability-scoped typed helper subpaths

- **Status:** accepted
- **Date:** 2026-10-08
- **Supersedes:** [0021](./0021-prop-test-schema-root-wrapper.md) as to helper placement and the public runtime surface

## Context

The user wants typed wrappers grouped by the capability they describe rather than
at the root. The schema wrapper added by ADR 0021 is a property-testing helper;
shared scenario callbacks likewise benefit from phase-specific contextual typing.
The previous decision put `propTestSchema` at the root and kept scenario step
callbacks type-only. The user now requests narrow `bun-test-utils/pbt` and
`bun-test-utils/bdd` entrypoints for the helpers.

## Decision

The root runtime API returns to exactly `describe`, `expect`, and `test`.
`propTestSchema` is removed from the root and exported only from
`bun-test-utils/pbt`. That subpath also exports the PBT type aliases
`FastCheckApi`, `ArbitraryInput`, and `GeneratedValues`.

`bun-test-utils/bdd` exports three runtime identity wrappers:

- `givenStep<Context, Added>(step)` for a `GivenStep<Context, Added>` callback.
- `whenStep<Context, Added>(step)` for a `WhenStep<Context, Added>` callback.
- `thenStep<Context>(step)` for a `ThenStep<Context>` callback.

Each returns the supplied callback unchanged. The BDD subpath also exports the
type-only aliases `ScenarioContext`, `GivenChain`, `GivenStep`, `WhenStep`, and
`ThenStep`. These aliases and the PBT type aliases are removed from the root
entrypoint; root `test.prop` and `test.scenario` remain fully typed through
inference.

The package export map exposes only `.`, `./package.json`, `./pbt`, and `./bdd`.
The two capability subpaths expose only their typed helper/type surfaces; they
do not expose runners, fixture packs, or internal capability APIs. No other
subpath, root helper, or `test.*` member is added.

This amends ADRs 0012, 0013, and 0021 only as needed for helper placement and the
two narrow subpaths. It does not change fixture autodetection, schema/step
composition, optional-peer runtime behavior, or the decision to keep this work
out of `0.1.0`.

## Consequences

**Good**

- Capability-specific helpers live at predictable imports without enlarging
the root runtime API.
- Phase-specific step wrappers make the callback's input state and returned
  state explicit in its generic arguments.
- Ordinary schema spread and consumer-owned scenario sequence functions remain
  unchanged.

**Trade-offs**

- The package gains two public export-map entries that must be kept stable and
  covered by the packed-consumer audit.
- The helpers are identity functions; they exist only for typing and discovery.
- Consumers using named PBT or scenario-step types must import them from the
  corresponding subpath.

## Alternatives considered

- Keep `propTestSchema` at the root and make only the step wrappers capability-
  scoped; rejected in favor of one consistent subpath-per-capability convention.
- Re-export the existing helpers and types from the root for compatibility;
  rejected because the user asked for a strict move and this package is not yet
  released.
- Expose the complete PBT/BDD runners or fixture packs from the subpaths;
  rejected because `test.*` and the root fixture context remain the execution
  APIs.

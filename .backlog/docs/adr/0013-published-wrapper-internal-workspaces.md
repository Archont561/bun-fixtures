# 0013 — Published wrapper over internal workspaces

- **Status:** revised, amended by [0021](./0021-prop-test-schema-root-wrapper.md) and [0022](./0022-typed-helper-subpaths.md)
- **Supersedes:** [0011](./0011-brand-identity-and-modular-ecosystem.md)

## Context

The repository publishes one npm package, `bun-test-utils`, while maintaining distinct capabilities as private workspaces. At the time of this decision the public surface was the root package only; ADR 0022 later authorizes two helper-only subpaths without exposing the private runners or fixture packs.

## Decision

`packages/bun-test-utils` is the public assembly wrapper. It owns the npm manifest, root entrypoint, CLI adapter, licences, README, conformance tests, behavioural scratch projects, installed CLI tests, tarball audit, and consumer quickstarts.

The fixture engine, type definitions, CLI internals, and capability implementations live in private sibling workspaces under `packages/`. Bunup bundles the internal workspaces into the root `dist/plugin.js` entrypoint. At that time, the published package exported only `.` and `./package.json`; users imported the runner values from the root:

```ts
import { describe, expect, test } from "bun-test-utils";
```

ADR 0021 later added the root runtime helper `propTestSchema`; ADR 0022 moved
it to the narrow `./pbt` helper subpath and added typed step wrappers at
`./bdd`; ADR 0023 renamed the PBT helper to `defineArbitraries`. Those subpaths
expose no runners or fixture packs. Property tests, fluent scenarios, and
built-in fixtures remain available from `test.*` and the test context. Mocking
belongs in fixtures composed with `test.extend()`.

Every internal package uses parallel `src/` and `tests/` directories. A test file mirrors the source module it primarily verifies; cross-capability behavior is covered in the wrapper conformance and packed-consumer suites.

## Consequences

**Good:** the npm package has one auditable root runner API and no generated staging tree. ADR 0022 later adds only helper-scoped `/pbt` and `/bdd` entries, not capability-runner compatibility paths.

**Good:** internal workspaces can change shape without changing user imports.

**Trade-off:** capability runners and error classes remain internal; consumers observe errors by `name`, `message`, and `code` on thrown values rather than importing classes. ADR 0022 permits only typed definition wrappers and aliases from the helper subpaths.

## Alternatives considered

- **Publish every workspace independently:** rejected because it creates version skew and multiple install targets.
- **Expose capability runner/fixture subpaths from the single package:** rejected because it expands the public API and creates another runner import surface. ADR 0022 later permits only helper-only `/pbt` and `/bdd` paths.
- **Stage internal sources under the wrapper:** rejected; Bunup can bundle the private workspaces directly, while the only public helper subpaths remain tiny wrapper entrypoints.

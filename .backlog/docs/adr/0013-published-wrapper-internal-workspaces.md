# 0013 — Published wrapper over internal workspaces

- **Status:** revised, amended by [0021](./0021-prop-test-schema-root-wrapper.md)
- **Supersedes:** [0011](./0011-brand-identity-and-modular-ecosystem.md)

## Context

The repository publishes one npm package, `bun-test-utils`, while maintaining distinct capabilities as private workspaces. End users should not import those workspaces or any package subpaths; the public surface is the root package only.

## Decision

`packages/bun-test-utils` is the public assembly wrapper. It owns the npm manifest, root entrypoint, CLI adapter, licences, README, conformance tests, behavioural scratch projects, installed CLI tests, tarball audit, and consumer quickstarts.

The fixture engine, type definitions, CLI internals, and capability implementations live in private sibling workspaces under `packages/`. Bunup bundles the internal workspaces into the root `dist/plugin.js` entrypoint. The published package exports only `.` and `./package.json`; users originally
imported the runner values from the root:

```ts
import { describe, expect, test } from "bun-test-utils";
```

ADR 0021 later adds exactly one top-level runtime helper, `propTestSchema`,
without changing the package export map or allowing capability subpaths.
Property tests, fluent scenarios, and built-in fixtures are available from
`test.*` and the test context. Mocking belongs in fixtures composed with
`test.extend()`.

Every internal package uses parallel `src/` and `tests/` directories. A test file mirrors the source module it primarily verifies; cross-capability behavior is covered in the wrapper conformance and packed-consumer suites.

## Consequences

**Good:** the npm package has one auditable root API, no generated staging tree, and no public subpath compatibility burden.

**Good:** internal workspaces can change shape without changing user imports.

**Trade-off:** capability-specific helpers and error classes are no longer user-facing exports; consumers observe errors by `name`, `message`, and `code` on thrown values rather than importing classes.

## Alternatives considered

- **Publish every workspace independently:** rejected because it creates version skew and multiple install targets.
- **Expose capability subpaths from the single package:** rejected because it expands the public API beyond `describe`, `test`, and `expect`.
- **Stage internal sources under the wrapper:** rejected after removing public subpaths; Bunup can bundle the private workspaces directly.

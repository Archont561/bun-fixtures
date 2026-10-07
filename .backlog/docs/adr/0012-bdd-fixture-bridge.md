# 0012 — BDD-style scenarios through the root `test` API

- **Status:** accepted, amended by [0021](./0021-prop-test-schema-root-wrapper.md)

## Context

At the time of this decision, the package exposed only `describe`, `test`, and
`expect` to end users. ADR 0021 later amended that root surface only to add the
`propTestSchema` identity wrapper; no BDD or capability subpaths were added. A
separate BDD subpath would violate the public-surface rule and make fixture
availability depend on helper imports outside the test context.

## Decision

BDD-style tests are modeled as fluent scenarios on `test`:

- `test.scenario(title)` for ordinary scenarios.
- `test.scenario.prop(title, arbitraryFactory)` for generated scenarios.
- Fixtures and mocks are regular fixture values in each step context.

The repository-wide Gherkin runner is test-only infrastructure and is not
published as a user-facing subpath.

## Consequences

**Good** — all public test styles hang off `test.*`, and all state enters through
fixture context or returned scenario values.

**Good** — users do not need to learn or import a BDD-specific package path.

**Trade-off** — projects that need a third-party Gherkin runner must keep that
integration outside the published API.

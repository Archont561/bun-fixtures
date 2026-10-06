# 0012 — BDD-style scenarios through the root `test` API

- **Status:** revised

## Context

The package now exposes only `describe`, `test`, and `expect` to end users. A
separate BDD subpath would violate that public-surface rule and make fixture
availability depend on helper imports outside the test context.

## Decision

BDD-style tests are modeled as fluent scenarios on `test`:

- `test.scenario(title)` for ordinary scenarios.
- `test.scenario.prop(title, arbitraryFactory)` for generated scenarios.
- Fixtures and mocks are regular fixture values in each step context.

The lower-level Gherkin hook bridge is retained only as an internal workspace
implementation/testing detail and is not published as a user-facing subpath.

## Consequences

**Good** — all public test styles hang off `test.*`, and all state enters through
fixture context or returned scenario values.

**Good** — users do not need to learn or import a BDD-specific package path.

**Trade-off** — projects that need a third-party Gherkin runner must write their
own small adapter around internal fixture maps; that adapter is outside the
published API.

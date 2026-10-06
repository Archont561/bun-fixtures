# Package test layout specification

Every runtime package follows this layout:

```text
src/                 production code
tests/unit/          isolated implementation tests
tests/integration/   internal cross-module tests
e2e/                 black-box consumer tests
e2e/bdd/features/    Gherkin workflows
e2e/bdd/steps/       step definitions
e2e/bdd/features.test.ts  package-owned BDD entrypoint
```

A BDD scenario belongs in `e2e/bdd` when it describes a user or consumer workflow
or crosses a public package boundary. Unit and integration tests must not depend on
Gherkin discovery. The config package may provide preset values such as repository
root and default glob construction, but package runners provide package name,
feature selection, step definitions, and any environment-specific settings.

Required scripts for runtime packages:

```json
{
  "test": "bun test tests",
  "test:bdd": "bun test e2e/bdd/features.test.ts",
  "test:e2e": "bun test e2e"
}
```

Packages without direct E2E scenarios may retain the scripts for workspace-level
consistency, but their runner must not discover another package's features.

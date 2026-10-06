# ADR-0016: Package test layout and E2E BDD

## Status

Accepted. Amended by [ADR-0017](./0017-shared-bdd-runner-helper.md): the BDD plugin
wiring moved into a `runPackageFeatures` helper in `@bun-test-utils/config/bdd`, and that
package now owns unit tests for its own exports. Packages still own the entrypoint file,
its location, and the package it names.

## Decision

Production code lives in `src/`. Package-owned unit and integration tests live in
`tests/`. BDD describes externally observable workflows, so BDD assets live under
`e2e/bdd/` alongside other consumer-facing end-to-end tests:

```text
packages/<package>/
├── src/
├── tests/
│   ├── unit/
│   └── integration/
└── e2e/
    ├── bdd/
    │   ├── features/
    │   ├── steps/
    │   └── features.test.ts
    └── *.test.ts
```

The `@bun-test-utils/config` package exposes reusable BDD presets only. It does not
own a test runner or a repository-wide test suite. Each package owns its BDD runner,
feature selection, and package-specific settings.

## Consequences

- Feature files are never stored in a top-level `features/` directory.
- Step definitions are colocated with the BDD suite in `e2e/bdd/steps/`.
- `test:e2e` runs direct TypeScript E2E tests; `test:bdd` runs the package's E2E BDD runner.
- Cross-package consumer behavior belongs to `packages/bun-test-utils/e2e/`.
- Internal implementation behavior remains covered by `tests/unit` or `tests/integration`.

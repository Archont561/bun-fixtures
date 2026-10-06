# 0017 — Shared BDD runner helper in the config workspace

- **Status:** accepted — amends [ADR 0016](./0016-package-test-layout-and-e2e-bdd.md)
- **Date:** 2026-10-06

## Context

[ADR 0016](./0016-package-test-layout-and-e2e-bdd.md) gave every package its own BDD
entrypoint at `packages/<pkg>/e2e/bdd/features.test.ts`, and drew the line at
`@bun-test-utils/config` exposing "reusable BDD presets only": each package owned its
runner, its feature selection, and its settings.

In practice the nine runners were byte-identical apart from the package name — fifteen
lines of plugin registration, a `../../../../` walk to the repository root, and a
`loadFeatures` call, copied nine times. During PR #19 one syntax error was copied with
them, and because the runners are discovered by `bun test` at the repository root, the
single mistake broke the suite nine times over and took `bun install` down with it.

Nothing in that boilerplate is a package decision. The two things that genuinely belong
to a package — *which* package the features are for, and the fact that the entrypoint
exists at all — are one identifier and one file.

## Decision

`@bun-test-utils/config/bdd` exports `runPackageFeatures(packageName, importMeta)`, which
registers the cucumber plugin and loads that package's features in one step. Every
package's entrypoint becomes a single call:

```ts
import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("std", import.meta);
```

1. **Packages still own their runner.** The entrypoint file stays at
   `packages/<pkg>/e2e/bdd/features.test.ts` and still names its own package. What moved
   is wiring, not ownership: `cwd` derivation, glob construction, and plugin registration.
2. **The helper derives the repository root from the runner's own location** rather than
   from a relative-segment count. A runner anywhere other than the ADR-0016 entrypoint
   path, or one naming a package other than its own directory, throws an error quoting
   the required path instead of silently matching zero features.
3. **The helper lives in the private `config` workspace**, not in `@bun-test-utils/bdd`.
   `bdd` is a capability pack that these very suites exercise; wiring all nine suites
   through a package under test means a regression there cannot be observed by the suites
   it broke. `config` is private, never published, and not a subject of any BDD scenario.
4. **`config` owns unit tests for the helpers it exports.** ADR 0016 said this package
   "does not own a test suite", meaning no repository-wide suite; that still holds. It
   now carries `tests/` covering its own exports, because nine suites depend on them.
5. **Step discovery stays repo-wide** (`packages/*/e2e/bdd/steps/**/*.steps.ts`): the
   steps drive scratch projects through the public surface and serve every package.

## Consequences

**Good**

- The failure class from PR #19 is gone: there is one copy of the wiring, and it is
  typechecked, linted, and unit-tested on its own.
- A misplaced or misnamed runner fails immediately with the path it should have, instead
  of reporting a green suite that ran no scenarios.
- 135 lines of entrypoint became 27, and adding a package's BDD suite is now one line.

**Bad**

- A helper regression now takes all nine suites down at once instead of one. This is the
  explicit trade: concentrated risk against nine-fold duplication, mitigated by the
  helper's own unit suite and by keeping it out of any package under test.
- `config` is no longer purely declarative — it ships runtime code that imports `bun` and
  `@aboviq/bun-test-cucumber`. It remains private and unpublished.

## Alternatives considered

- **Keep the nine copies, add a lint rule.** A rule can catch drift between the copies
  but not the duplication itself, and the PR #19 error was syntactically identical in all
  nine files — consistent, and consistently wrong.
- **Put the helper in `@bun-test-utils/bdd`.** Rejected: it is the package under test in
  several of these suites, and it is published, so internal harness wiring would leak
  into the public surface.
- **Generate the runners from a template.** Rejected: generated files still get hand-edited,
  and it adds a build step to a layer whose whole job is to start a test run.

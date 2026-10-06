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
Gherkin discovery.

`e2e/bdd/features.test.ts` is the required entrypoint form, and it MUST be exactly one
call into the shared helper ([ADR-0017](../../.backlog/docs/adr/0017-shared-bdd-runner-helper.md)):

```ts
import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("<package-dir>", import.meta);
```

A runner MUST NOT restate the repository root, the feature or step globs, or the plugin
registration; the helper derives all of them, and rejects a runner that is not at
`packages/<package-dir>/e2e/bdd/features.test.ts`. Step definitions stay discoverable
repo-wide (`packages/*/e2e/bdd/steps/**/*.steps.ts`), so shared steps serve every package.

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

# 0014 — BDD-style scenarios on `test.*` (runner remains on root)

- **Status:** revised
- **Stability:** experimental; may change in minor releases while it depends on pre-1.0 `@aboviq/bun-test-cucumber` ([ADR 0018](../adr/0018-release-compatibility-contract.md))
- **Implementation:** `packages/bdd/src/index.ts`, `packages/core/src/plugin.ts`, `packages/pbt/src/index.ts`, public root `test.scenario(...)`
- **Tests:** `packages/bdd/tests/index.test.ts`, `packages/bun-test-utils/tests/conformance/scenario.test.ts`, `packages/bun-test-utils/features/capability-packs.feature`

## Current decision

BDD-style tests are expressed through root `test.scenario(...)` and
`test.scenario.prop(...)`; fixtures are available in the scenario context
exactly like ordinary tests. ADR 0022 later adds a helper-only
`bun-test-utils/bdd` subpath for typed step callbacks and aliases. It does not
expose the scenario runner, fixtures, or `withBDDTesting(coreTest)`, which
remains internal and gates scenario declarations behind the optional
`@aboviq/bun-test-cucumber` peer.

```ts
import { test } from "bun-test-utils";

test.scenario("checks a file")
  .given("a file", async ({ tmpdir }) => {
    tmpdir.write("answer.txt", "42");
    return { file: "answer.txt" };
  })
  .when("the file is read", ({ tmpdir, file }) => ({ value: tmpdir.read(file) }))
  .then("the value is asserted", ({ value, expect }) => {
    expect(value).toBe("42");
  });
```

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `test.scenario(title)` MUST support ordered `given`, `when`, and `then` phases. |
| R2 | Values returned from `given` and `when` MUST be merged into later step contexts. |
| R3 | Fixture values MUST be available in every step context. |
| R4 | `test.scenario.prop(title, arbitraryFactory)` MUST combine generated values with scenario state and fixture context. |
| R5 | The published package MUST NOT expose a BDD runner or fixture-pack subpath. The helper-only typed-definition exports authorized by ADR 0022 are the sole exception. |
| R6 | The internal BDD workspace MUST expose `withBDDTesting(coreTest)` so the root wrapper composes BDD behaviour the same way it composes PBT behaviour. |
| R7 | `test.scenario(...)` MUST throw an actionable missing-peer error until the user installs `@aboviq/bun-test-cucumber`. |

## Implementation note

The internal BDD workspace supplies the `test.scenario(...)` wrapper.
Repository-wide Gherkin tests use their own test-only step definitions. ADR 0022
adds only identity wrappers and related types to the public helper subpath; the
runner and its integration remain internal.

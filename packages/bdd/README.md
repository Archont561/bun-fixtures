# BDD integration (internal)

> **Experimental:** BDD capability APIs may change in minor releases while the
> integration depends on pre-1.0 `@aboviq/bun-test-cucumber`.

The BDD workspace mirrors the PBT package shape for fluent scenario support. It exports `withBDDTesting(coreTest)`, which wraps a core fixture-aware test runner and gates `test.scenario(...)` behind the optional `@aboviq/bun-test-cucumber` peer.

Scenario execution remains on the public root `test.scenario(...)` API:

```ts
import { test } from "@archont561/bun-test-utils";
```

The helper-only `@archont561/bun-test-utils/bdd` subpath exports the `givenStep`, `whenStep`,
and `thenStep` identity wrappers plus scenario type aliases. It does not expose
the runner, fixture packs, or `withBDDTesting`. Projects that execute fluent
scenarios install the optional peer:

```bash
bun add -d @aboviq/bun-test-cucumber
```

```ts
test.scenario("checks a file")
  .given("a file", async ({ tmpdir }) => {
    tmpdir.write("answer.txt", "42");
    return { file: "answer.txt" };
  })
  .when("the file is read", ({ tmpdir, file }) => ({
    value: tmpdir.read(file),
  }))
  .then("the value is asserted", ({ value, expect }) => {
    expect(value).toBe("42");
  });
```

## Reusing typed steps

Steps can be exported from a shared module and imported by multiple scenarios. Wrap callbacks with `givenStep`, `whenStep`, and `thenStep` from `@archont561/bun-test-utils/bdd`; their generic arguments contextually type each phase's input state and (for `given`/`when`) returned state. `GivenStep`, `WhenStep`, `ThenStep`, `ScenarioContext`, and `GivenChain` are also available as type-only exports from the same subpath. A small consumer-owned function can apply a reusable sequence to a `GivenChain`:

```ts
// scenario-steps.ts
import { givenStep, thenStep, whenStep } from "@archont561/bun-test-utils/bdd";
import type { GivenChain } from "@archont561/bun-test-utils/bdd";

export const writeFile = givenStep<object, { filename: string }>(({ tmpdir }) => {
  const filename = "shared.txt";
  tmpdir.write(filename, "shared scenario data");
  return { filename };
});

export const readFile = whenStep<{ filename: string }, { contents: string }>(
  ({ tmpdir, filename }) => ({ contents: tmpdir.read(filename) }),
);

export const assertContents = thenStep<{ contents: string }>(
  ({ contents, expect }) => expect(contents).toBe("shared scenario data"),
);

export const withSharedFile = (chain: GivenChain) =>
  chain.given("a shared file", writeFile).when("the file is read", readFile);
```

```ts
// first.test.ts and second.test.ts can both use this sequence
import { test } from "@archont561/bun-test-utils";
import { assertContents, withSharedFile } from "./scenario-steps";

withSharedFile(test.scenario("reads a shared file")).then(
  "the shared contents are available",
  assertContents,
);
```

Fixtures destructured by imported steps are auto-detected for each step; do not repeat a fixture list on the scenario. The sequence function belongs to the consumer; the helper wrappers add no `test.*` member and expose no scenario runner. Mocking and BDD state should be modeled as fixtures and values in the scenario context.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

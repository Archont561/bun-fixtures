# BDD integration (internal)

> **Experimental:** BDD capability APIs may change in minor releases while the
> integration depends on pre-1.0 `@aboviq/bun-test-cucumber`.

The BDD workspace mirrors the PBT package shape for fluent scenario support. It exports `withBDDTesting(coreTest)`, which wraps a core fixture-aware test runner and gates `test.scenario(...)` behind the optional `@aboviq/bun-test-cucumber` peer.

End users still import only from the public root package:

```ts
import { test } from "bun-test-utils";
```

There is no public `bun-test-utils/bdd` subpath. Projects that use fluent scenarios install the optional peer:

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

Steps can be exported from a shared module and imported by multiple scenarios. The type-only `GivenStep`, `WhenStep`, and `ThenStep` aliases describe each step's context and returned state. A small consumer-owned function can apply a reusable sequence to a `GivenChain`:

```ts
// scenario-steps.ts
import type { GivenChain, GivenStep, ThenStep, WhenStep } from "bun-test-utils";

export const writeFile: GivenStep<object, { filename: string }> = ({ tmpdir }) => {
  const filename = "shared.txt";
  tmpdir.write(filename, "shared scenario data");
  return { filename };
};

export const readFile: WhenStep<{ filename: string }, { contents: string }> = ({
  tmpdir,
  filename,
}) => ({ contents: tmpdir.read(filename) });

export const assertContents: ThenStep<{ contents: string }> = ({
  contents,
  expect,
}) => expect(contents).toBe("shared scenario data");

export const withSharedFile = (chain: GivenChain) =>
  chain.given("a shared file", writeFile).when("the file is read", readFile);
```

```ts
// first.test.ts and second.test.ts can both use this sequence
import { test } from "bun-test-utils";
import { assertContents, withSharedFile } from "./scenario-steps";

withSharedFile(test.scenario("reads a shared file")).then(
  "the shared contents are available",
  assertContents,
);
```

Fixtures destructured by imported steps are auto-detected for each step; do not repeat a fixture list on the scenario. The sequence function belongs to the consumer and adds no `test.*` member or runtime helper to the package. Mocking and BDD state should be modeled as fixtures and values in the scenario context.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

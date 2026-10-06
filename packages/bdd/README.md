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

Mocking and BDD state should be modeled as fixtures and values in the scenario context.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

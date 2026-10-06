# BDD integration (internal)

The historical Gherkin bridge is internal. End users should use the public root `test.scenario(...)` and `test.scenario.prop(...)` APIs from `bun-test-utils` for BDD-style tests; there is no public `bun-test-utils/bdd` subpath.

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

Mocking and BDD state should be modeled as fixtures and values in the scenario context.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

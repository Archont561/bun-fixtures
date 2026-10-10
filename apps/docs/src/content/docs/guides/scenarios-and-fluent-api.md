---
title: Scenarios and fluent API
description: Write behaviour-driven tests with given, when, and then steps that share typed state and fixtures.
---

A scenario is one test written as fluent `given`, `when`, and `then` steps. Each step can read the state the steps before it produced, and each step can use fixtures. Scenarios are a readable form of an ordinary fixture-aware test, so they support the same fixtures, scopes, and teardown.

> Scenarios are experimental. Their API may change in a minor release.

## Installation

The scenario API uses the optional `@aboviq/bun-test-cucumber` peer:

```bash
bun add -d @archont561/bun-test-utils @aboviq/bun-test-cucumber
```

Property scenarios also need `fast-check`:

```bash
bun add -d fast-check
```

## A fluent scenario

```ts
import { test } from "@archont561/bun-test-utils";

test
  .scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .given("a request id", () => ({ requestId: "req-1" }))
  .when("the user is created", ({ name, requestId }) => ({
    user: { id: 1, name },
    requestId,
  }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBe(1);
  })
  .then("the request is retained", ({ requestId, expect }) => {
    expect(requestId).toBe("req-1");
  });
```

The chain is typed in phase order: `given` steps come first, then `when`, then `then`. Each phase accepts several steps.

- An object returned by a `given` or `when` step is merged into the context of the next step.
- A `then` step is an assertion. Its return value is not merged.
- `expect` is passed into every step, so you do not import it.

## Use fixtures in steps

Fixture values are available alongside scenario state. Destructure a fixture in a step, and the engine builds it for the scenario like any other test:

```ts
test
  .scenario("stores a record")
  .given("a record", async ({ database }) => ({
    record: await database.insert({ name: "Ada" }),
  }))
  .then("the record has an id", ({ record, expect }) => {
    expect(record.id).toBeDefined();
  });
```

Fixtures are composed the same way as in any other test: with `test.extend()`, in the imported runner.

## Share steps and sequences

Put reusable steps in a shared module. The phase-specific helpers from `@archont561/bun-test-utils/bdd` give each step its input and output types. The generic arguments declare the state a step expects, and the state it adds:

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

export const assertSharedContents = thenStep<{ contents: string }>(
  ({ contents, expect }) => expect(contents).toBe("shared scenario data"),
);

export const withSharedFile = (chain: GivenChain) =>
  chain.given("a shared file", writeFile).when("the file is read", readFile);
```

A consumer-owned function can apply the sequence to any chain, so several scenario files can reuse it:

```ts
// reads-shared-file.test.ts
import { test } from "@archont561/bun-test-utils";
import { assertSharedContents, withSharedFile } from "./scenario-steps";

withSharedFile(test.scenario("reads a file from a shared sequence")).then(
  "the contents are available",
  assertSharedContents,
);
```

Steps that destructure fixtures are detected per step, so the scenario does not repeat a fixture list.

## Property scenarios

`test.scenario.prop` generates the scenario's initial context:

```ts
import { test } from "@archont561/bun-test-utils";

test.scenario
  .prop("calculates a total", (fc) => ({
    price: fc.integer({ min: 0, max: 100 }),
  }))
  .given("a quantity", () => ({ quantity: 2 }))
  .when("the total is calculated", ({ price, quantity }) => ({
    total: price * quantity,
  }))
  .then("the total is non-negative", ({ total, expect }) => {
    expect(total).toBeGreaterThanOrEqual(0);
  });
```

Each generated example gets a fresh scenario context. Test-scoped fixtures are rebuilt for every example and every shrink step, while session and file fixtures are shared. See [Property-based testing](/bun-test-utils/guides/property-based-testing/) for the lifecycle.

## Next steps

- [Property-based testing](/bun-test-utils/guides/property-based-testing/) for generated values and shared arbitrary definitions.
- [API reference](/bun-test-utils/reference/api/) for the `test.scenario` signatures.

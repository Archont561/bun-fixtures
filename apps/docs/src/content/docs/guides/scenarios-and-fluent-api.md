---
title: Scenarios and fluent API
description: Share state across given, when, and then steps with typed fluent scenarios.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


Scenarios are a readable wrapper around one fixture-aware test. Each `given` and `when` step may return an object; its properties are merged into the next step's context.

## Installation

The fluent scenario API is optional. Install the BDD peer only in projects that use it:

```bash
bun add -d bun-test-utils @aboviq/bun-test-cucumber
```

Property scenarios also require `fast-check`:

```bash
bun add -d fast-check
```

## A fluent scenario

```ts
import { test } from "bun-test-utils";

test.scenario("creates a user")
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

Steps can be asynchronous. Fixture values are available alongside scenario state:

```ts
test.scenario("uses a fixture")
  .given("a record", async ({ db }) => ({
    record: await db.insert({ name: "Ada" }),
  }))
  .then("the record exists", ({ record, expect }) => {
    expect(record.id).toBeDefined();
  });
```

## Sharing typed steps and sequences

Steps are plain callbacks, so put them in a shared module and import them into
each scenario. `GivenStep`, `WhenStep`, and `ThenStep` describe the state each
callback reads and returns. A consumer-owned function can apply a reusable
sequence to a `GivenChain`; the function is ordinary application code, not a
new `bun-test-utils` runtime helper.

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

export const assertSharedContents: ThenStep<{ contents: string }> = ({
  contents,
  expect,
}) => expect(contents).toBe("shared scenario data");

export const withSharedFile = (chain: GivenChain) =>
  chain.given("a shared file", writeFile).when("the file is read", readFile);
```

Use the same sequence from separate scenario files:

```ts
// first.test.ts (second.test.ts imports the same sequence)
import { test } from "bun-test-utils";
import { assertSharedContents, withSharedFile } from "./scenario-steps";

withSharedFile(test.scenario("reads a file from a shared sequence")).then(
  "the contents are available",
  assertSharedContents,
);
```

Fixtures destructured by imported steps are auto-detected per step, just as
inline steps are; scenarios do not need to repeat a fixture list. Continue to
compose project fixtures explicitly with `test.extend()`.

`then` steps are assertions and their return values are not merged. The chain is typed so `given` comes before `when`, `when` comes before `then`, and multiple steps in each phase are supported.

## Property scenarios

`test.scenario.prop(...)` adds generated values as the initial context:

```ts
import { test } from "bun-test-utils";

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

Every generated example receives a fresh scenario context. Test-scoped fixtures are rebuilt for each example and shrink candidate; session and file fixtures are shared.

See the [property testing guide](/bun-test-utils/guides/property-based-testing/) and the [package examples on GitHub](https://github.com/Archont561/bun-test-utils/tree/main/packages/bun-test-utils/features).

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

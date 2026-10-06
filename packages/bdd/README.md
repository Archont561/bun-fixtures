# BDD fixture bridge

`bun-test-utils/bdd` connects a Gherkin runner's scenario lifecycle to fixture setup and teardown. It does not implement a Gherkin parser; it adapts any runner with `Before` and `After` hooks.

## Attach fixtures to a world

```ts
import { fixtureSteps } from "bun-test-utils/bdd";

fixtureSteps(hooks, {
  account: {
    setup: async (use) => {
      await use({ id: "account-1" });
    },
  },
}, ["account"]);
```

Each scenario gets a fresh world with `account` attached. The fixture is closed by the matching `After` hook, including when the scenario fails.

## A normal scenario test

```ts
import { expect, test } from "bun:test";
import { fixtureSteps } from "bun-test-utils/bdd";

test("connects hooks to a scenario world", async () => {
  let before;
  let after;
  const hooks = {
    Before(fn) { before = fn; },
    After(fn) { after = fn; },
  };

  fixtureSteps(hooks, {
    answer: {
      setup: async (use) => {
        await use(42);
      },
    },
  }, ["answer"]);

  const world = {};
  await before(world);
  expect(world.answer).toBe(42);
  await after(world);
});
```

`openFixtures` is also available for custom integrations. See the [BDD guide](https://archont561.github.io/bun-test-utils/reference/plugins/#bun-test-utilsbdd), the [Gherkin feature suite](../bun-test-utils/features/), and [`tests/`](./tests/).

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).

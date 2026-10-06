import { expect, test } from "bun:test";
import { fixtureSteps } from "@/index.ts";

test("registers before and after hooks", () => {
  const hooks = {
    before: undefined as
      | ((world: Record<string, unknown>) => Promise<void>)
      | undefined,
    after: undefined as
      | ((world: Record<string, unknown>) => Promise<void>)
      | undefined,
    Before(fn: (world: Record<string, unknown>) => Promise<void>) {
      this.before = fn;
    },
    After(fn: (world: Record<string, unknown>) => Promise<void>) {
      this.after = fn;
    },
  };

  fixtureSteps(
    hooks,
    {
      value: {
        setup: async (use) => {
          await use("ok");
        },
      },
    },
    ["value"],
  );

  expect(hooks.before).toBeFunction();
  expect(hooks.after).toBeFunction();
});

test("isolates fixture scopes between worlds and tears down each scenario", async () => {
  const events: string[] = [];
  const before: Array<
    (world: Record<string, unknown>) => void | Promise<void>
  > = [];
  const after: Array<(world: Record<string, unknown>) => void | Promise<void>> =
    [];

  fixtureSteps(
    {
      Before(fn) {
        before.push(fn);
      },
      After(fn) {
        after.push(fn);
      },
    },
    {
      scenarioId: {
        scope: "test",
        setup: async (use) => {
          const id =
            events.filter((event) => event.startsWith("setup")).length + 1;
          events.push(`setup:${id}`);
          await use(id);
          events.push(`teardown:${id}`);
        },
      },
    },
    ["scenarioId"],
  );

  const first: Record<string, unknown> = {};
  const second: Record<string, unknown> = {};
  await before[0]!(first);
  await after[0]!(first);
  await before[0]!(second);
  await after[0]!(second);

  expect(first.scenarioId).toBe(1);
  expect(second.scenarioId).toBe(2);
  expect(first.scenarioId).not.toBe(second.scenarioId);
  expect(events).toEqual(["setup:1", "teardown:1", "setup:2", "teardown:2"]);
});

test("runs teardown when a scenario world is closed more than once", async () => {
  let teardowns = 0;
  const after: Array<(world: Record<string, unknown>) => void | Promise<void>> =
    [];
  const before: Array<
    (world: Record<string, unknown>) => void | Promise<void>
  > = [];

  fixtureSteps(
    {
      Before(fn) {
        before.push(fn);
      },
      After(fn) {
        after.push(fn);
      },
    },
    {
      value: {
        setup: async (use) => {
          await use("value");
          teardowns++;
        },
      },
    },
    ["value"],
  );

  const world: Record<string, unknown> = {};
  await before[0]!(world);
  await after[0]!(world);
  await after[0]!(world);
  expect(teardowns).toBe(1);
});

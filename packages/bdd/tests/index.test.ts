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

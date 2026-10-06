import { expect, test, withFixtures } from "bun-test-utils";
import { type BddHooks, fixtureSteps } from "bun-test-utils/bdd";
import { stdFixtures } from "bun-test-utils/std";
import { vcrFixtures } from "bun-test-utils/vcr";

const combined = { ...stdFixtures, ...vcrFixtures };

test("std and vcr subpaths compose through the public exports", async () => {
  const events: string[] = [];
  const fixtures = {
    tmpdir: {
      ...combined.tmpdir,
      setup: async (use: any, ctx: any) => {
        events.push("tmpdir:setup");
        await combined.tmpdir.setup(use, ctx);
        events.push("tmpdir:teardown");
      },
    },
    cassette: {
      ...combined.cassette,
      deps: ["tmpdir"],
      setup: async (use: any, ctx: any) => {
        events.push("cassette:setup");
        await combined.cassette.setup(use, ctx);
        events.push("cassette:teardown");
      },
    },
  };

  await withFixtures(
    fixtures,
    ["cassette"],
    {},
    async ({ tmpdir, cassette }) => {
      expect(tmpdir.path).toBeTruthy();
      expect(cassette).toBeTruthy();
    },
  );

  expect(events).toEqual([
    "tmpdir:setup",
    "cassette:setup",
    "cassette:teardown",
    "tmpdir:teardown",
  ]);
});

test("bdd subpath attaches fixtures and tears them down through hooks", async () => {
  const calls: string[] = [];
  const worlds: Array<Record<string, unknown>> = [];
  const before: Array<
    (world: Record<string, unknown>) => void | Promise<void>
  > = [];
  const after: Array<(world: Record<string, unknown>) => void | Promise<void>> =
    [];
  const hooks: BddHooks = {
    Before(fn) {
      before.push(fn);
    },
    After(fn) {
      after.push(fn);
    },
  };
  fixtureSteps(
    hooks,
    {
      value: {
        setup: async (use) => {
          calls.push("setup");
          await use("from-bdd");
          calls.push("teardown");
        },
      },
    },
    ["value"],
  );

  const world: Record<string, unknown> = {};
  await before[0]!(world);
  worlds.push(world);
  expect(world.value).toBe("from-bdd");
  await after[0]!(world);
  expect(calls).toEqual(["setup", "teardown"]);
  expect(worlds).toHaveLength(1);
});

test("fixture names from sibling subpaths do not silently overwrite", () => {
  const left = { shared: { setup: async (use: any) => use("left") } };
  const right = { shared: { setup: async (use: any) => use("right") } };
  expect(Object.keys({ ...left, ...right })).toEqual(["shared"]);
  expect(left.shared).not.toBe(right.shared);
});

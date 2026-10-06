import { describe, expect, seedFixture, test } from "@/index.ts";

const realRandom = Math.random;
const breadcrumbs: { sequence?: number[]; seed?: number } = {};

describe("@bun-test-utils/std seed", () => {
  test("makes Math.random deterministic and exposes the replay seed", async ({
    seed,
  }) => {
    seed.set(12345);
    breadcrumbs.seed = seed.value;
    breadcrumbs.sequence = [Math.random(), Math.random(), seed.random()];
    expect(breadcrumbs.sequence).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985,
    ]);
  });

  test("engine teardown restored Math.random", async () => {
    expect(Math.random).toBe(realRandom);
  });

  test("the same seed replays the same sequence", async ({ seed }) => {
    seed.set(breadcrumbs.seed!);
    expect([Math.random(), Math.random(), seed.random()]).toEqual(
      breadcrumbs.sequence!,
    );
  });

  test("reports the seed when the test body fails", async () => {
    const failure = new Error("boom");
    await expect(
      seedFixture.setup(
        async () => {
          throw failure;
        },
        { testFile: import.meta.path, testName: "failure example" },
      ),
    ).rejects.toThrow(/boom[\s\S]*seed: \d+/);
  });
});

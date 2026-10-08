import { describe, expect, seedFixture, test } from "@/index.ts";

const realRandom = Math.random;
const breadcrumbs: { sequence?: number[]; seed?: number } = {};

/** The default seed the engine derives for a test, read without running a body. */
async function defaultSeedFor(
  testFile: string,
  testName: string,
): Promise<number> {
  let observed = Number.NaN;
  await seedFixture.setup(
    async (helper) => {
      observed = helper.value;
    },
    { testFile, testName },
  );
  return observed;
}

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

  test("default seeds for ASCII and BMP names are unchanged", async () => {
    expect(
      await defaultSeedFor("/repo/tests/example.test.ts", "adds numbers"),
    ).toBe(3962981076);
    expect(
      await defaultSeedFor("/repo/tests/example.test.ts", "café 日本語"),
    ).toBe(54302562);
  });

  test("default seeds differ for names that differ only by a non-BMP character", async () => {
    const rocket = await defaultSeedFor(import.meta.path, "launch 🚀");
    const helicopter = await defaultSeedFor(import.meta.path, "launch 🚁");
    expect(rocket).not.toBe(helicopter);
  });
});

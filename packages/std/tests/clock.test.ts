import { describe, expect, test } from "@/index.ts";

const realNow = Date.now();
const frozen = new Date("2024-02-03T04:05:06.000Z");

describe("@bun-test-utils/std clock", () => {
  test("freezes and changes the system time", async ({ clock }) => {
    clock.freeze(frozen);
    expect(new Date().toISOString()).toBe("2024-02-03T04:05:06.000Z");

    clock.set("2025-06-07T08:09:10.000Z");
    expect(clock.now().toISOString()).toBe("2025-06-07T08:09:10.000Z");
  });

  test("engine teardown restored the system clock", async () => {
    expect(Math.abs(Date.now() - realNow)).toBeLessThan(30_000);
  });
});

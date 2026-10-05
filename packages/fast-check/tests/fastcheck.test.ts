import { describe, expect, fc, test } from "../src/index.ts";

describe("@bun-fixture/fast-check", () => {
  test.prop(
    "reverses string twice to get original value",
    {
      s: fc.string(),
    },
    async (_ctx, { s }) => {
      const reversedTwice = s.split("").reverse().reverse().join("");
      expect(reversedTwice).toBe(s);
    },
    { numRuns: 50 },
  );

  test.prop(
    "addition is commutative with generated numbers",
    {
      a: fc.integer(),
      b: fc.integer(),
    },
    async (_ctx, { a, b }) => {
      expect(a + b).toBe(b + a);
    },
    { numRuns: 50 },
  );
});

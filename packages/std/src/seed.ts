import { createFixture, fnv1a } from "@bun-test-utils/core";

export interface SeedHelper {
  /** The seed currently driving Math.random. */
  readonly value: number;
  /** Restarts the deterministic sequence with a replay seed. */
  set(seed: number): void;
  /** Draws from the same deterministic sequence as Math.random. */
  random(): number;
}

function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedFixture = createFixture<SeedHelper>({
  scope: "test",
  setup: async (use, { testFile, testName }) => {
    const originalRandom = Math.random;
    let value = fnv1a(`${testFile}:${testName ?? "session"}`);
    let random = generator(value);
    const helper: SeedHelper = {
      get value() {
        return value;
      },
      set(seed) {
        value = seed >>> 0;
        random = generator(value);
      },
      random() {
        return random();
      },
    };
    Math.random = () => helper.random();

    try {
      await use(helper);
    } catch (error) {
      if (error instanceof Error) {
        error.message = `${error.message}\n[bun-test-utils] seed: ${value}`;
      }
      throw error;
    } finally {
      Math.random = originalRandom;
    }
  },
});

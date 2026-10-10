import { createFixture } from "@bun-test-utils/core";

/**
 * Concurrency assumption (audit 2026-10-06, finding 4): restoration is a
 * whole-environment snapshot taken at setup and replayed at teardown, so two
 * overlapping `env` fixtures are only correct in LIFO order — the inner close
 * hands the environment back to the outer snapshot. Closing out of order
 * resurrects the value the still-open inner snapshot captured (pinned in
 * `tests/env-restoration.test.ts`). One env fixture in flight per process at
 * a time is the supported shape; Bun runs tests in a file sequentially, so
 * the test-scoped fixture satisfies that by default.
 */
export interface EnvHelper {
  /** Sets an environment variable. */
  set(key: string, value: string): void;
  /** Deletes an environment variable. */
  delete(key: string): void;
  /** Gets the value of an environment variable. */
  get(key: string): string | undefined;
  /** Returns a snapshot of current environment variables. */
  snapshot(): Record<string, string | undefined>;
}

export const envFixture = createFixture<EnvHelper>({
  scope: "test",
  setup: async (use) => {
    const original = { ...process.env };

    const helper: EnvHelper = {
      set(key: string, value: string) {
        process.env[key] = value;
      },
      delete(key: string) {
        delete process.env[key];
      },
      get(key: string) {
        return process.env[key];
      },
      snapshot() {
        return { ...process.env };
      },
    };

    try {
      await use(helper);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in original)) {
          delete process.env[key];
        }
      }
      for (const [key, value] of Object.entries(original)) {
        process.env[key] = value;
      }
    }
  },
});

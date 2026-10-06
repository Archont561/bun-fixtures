import type { FixtureDef } from "../../core/src/plugin.ts";

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

export const envFixture: FixtureDef<EnvHelper> = {
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
};

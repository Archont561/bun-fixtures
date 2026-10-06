import type { FixtureMap } from "@/types.ts";

export default {
  /** Explicit override of the same name in a nested test.extend() chain. */
  origin: {
    scope: "session",
    setup: async (use) => {
      await use("tests/nested");
    },
  },

  /** Visible only to tests that explicitly compose this fixture map. */
  nestedOnly: {
    setup: async (use, { origin }) => {
      await use(`hello from ${origin}`);
    },
  },
} satisfies FixtureMap;

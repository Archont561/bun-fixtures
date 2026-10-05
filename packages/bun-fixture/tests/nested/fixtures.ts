import type { FixtureMap } from "@/src/types.ts";

export default {
  /** Third override of the same name: root → tests → tests/nested. */
  origin: {
    scope: "session",
    setup: async (use) => {
      await use("tests/nested");
    },
  },

  /** Only visible to tests in this directory (and below). */
  nestedOnly: {
    setup: async (use, { origin }) => {
      await use(`hello from ${origin}`);
    },
  },
} satisfies FixtureMap;

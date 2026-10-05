import type { FixtureMap } from "bun-fixture";

/**
 * Lifecycle fixtures for the PBT suite: `box` must be recreated on every
 * property iteration and shrink (with LIFO teardown between samples), while
 * `lifecycle` (session) and `fileCache` (file) must be shared across them.
 */
const lifecycle: string[] = [];
let boxSeq = 0;

export default {
  lifecycle: {
    scope: "session",
    setup: async (use) => {
      lifecycle.push("lifecycle:setup");
      await use(lifecycle);
      lifecycle.push("lifecycle:teardown");
    },
  },

  /** test scope: fresh per iteration; events land in `lifecycle`. */
  box: {
    setup: async (use, { lifecycle }) => {
      const id = ++boxSeq;
      lifecycle.push(`box:setup:${id}`);
      await use({ id });
      lifecycle.push(`box:teardown:${id}`);
    },
  },

  /** file scope: one instance for this whole test file. */
  fileCache: {
    scope: "file",
    setup: async (use) => {
      await use({ marker: Math.random() });
    },
  },
} satisfies FixtureMap;

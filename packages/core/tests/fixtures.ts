import type { FixtureMap } from "@/types.ts";

let dbCount = 0;

/** Shared, append-only event log — lets the tests observe setup/teardown order. */
const events: string[] = [];

export default {
  /** session scope: built once for the whole `bun test` run. */
  events: {
    scope: "session",
    setup: async (use) => {
      events.push("events:setup");
      await use(events);
      events.push("events:teardown");
    },
  },

  /** session scope + dependency injection by name. */
  config: {
    scope: "session",
    setup: async (use, { origin }) => {
      await use({ name: "bun-test-utils", origin });
    },
  },
  /** Overridden by an explicit nested test.extend() chain. */
  origin: {
    scope: "session",
    setup: async (use) => {
      await use("tests");
    },
  },

  /** file scope: one instance shared by every test in a file. */
  db: {
    scope: "file",
    setup: async (use, { events }) => {
      const handle = { id: ++dbCount, rows: [] as string[] };
      events.push(`db:setup:${handle.id}`);
      await use(handle);
      events.push(`db:teardown:${handle.id}`);
    },
    deps: ["events"],
  },

  /** test scope (default): fresh for every test. */
  tmp: {
    setup: async (use, { events }) => {
      const value = { n: Math.random() };
      events.push("tmp:setup");
      await use(value);
      events.push("tmp:teardown");
    },
  },

  /** test scope, depends on another test-scoped fixture — teardown must be LIFO. */
  client: {
    setup: async (use, { tmp, events }) => {
      events.push("client:setup");
      await use({ tmp, connected: true });
      events.push("client:teardown");
    },
  },

  /** Parameterized: every requesting test runs once per param. */
  mode: {
    params: ["fast", "slow"],
    setup: async (use, ctx) => {
      await use(ctx.param);
    },
  },

  /** Parameterized too — combined, they produce a cartesian product. */
  region: {
    params: ["eu", "us"],
    setup: async (use, ctx) => {
      await use(ctx.param);
    },
  },

  /** A fixture with no teardown (never awaits `use`). */
  answer: {
    scope: "session",
    setup: (use) => {
      use(42);
    },
  },
} satisfies FixtureMap;

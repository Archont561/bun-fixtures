/** Verifies per-directory discovery and cross-file scope behaviour. */
// `@` is aliased to the package root (see tsconfig paths):
//   "@"   -> src/plugin.ts   "@/*" -> any file in the repo
import { createTest, fixturesFor } from "@";

const { test, describe, expect } = createTest(import.meta.path);

describe("directory scoping", () => {
  test("the nearest fixtures.ts wins", async ({ origin }) => {
    expect(origin).toBe("tests/nested");
  });

  test("inherits fixtures from ancestor directories", async ({
    db,
    config,
  }) => {
    expect(db.id).toBeGreaterThan(0);
    expect(config.name).toBe("bun-test-utils");
  });

  test("directory-local fixtures are visible here", async ({ nestedOnly }) => {
    expect(nestedOnly).toBe("hello from tests/nested");
  });

  test("but not from a sibling directory", () => {
    const sibling = fixturesFor(`${import.meta.dir}/../fixtures.test.ts`);
    expect(sibling.nestedOnly).toBeUndefined();
    expect(fixturesFor(import.meta.path).nestedOnly).toBeDefined();
  });

  test("session fixtures are shared across files", async ({ events }) => {
    expect(events).toContain("events:setup");
    expect(events.filter((e: string) => e === "events:setup")).toHaveLength(1);
  });

  test("file-scoped fixtures are per file", async ({ db, events }) => {
    // tests/fixtures.test.ts built db#1 and tore it down at its afterAll.
    expect(events).toContain("db:teardown:1");
    expect(db.id).toBe(2);
  });
});

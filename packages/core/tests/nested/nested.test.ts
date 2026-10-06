/** Verifies explicit composition and cross-file scope behaviour. */
// `@/*` resolves files from this package's source directory.
import { createTest } from "@/plugin.ts";
import parentFixtures from "../fixtures.ts";
import nestedFixtures from "./fixtures.ts";

const { test: base, describe, expect } = createTest(import.meta.path);
const parentOnly = base.extend(parentFixtures);
const test = parentOnly.extend(nestedFixtures);

describe("explicit fixture composition", () => {
  test("the nearest explicit override wins", async ({ origin }) => {
    expect(origin).toBe("tests/nested");
  });

  test("parent fixtures are available only when composed", async ({ db }) => {
    expect(db.id).toBeGreaterThan(0);
  });

  test("nested fixtures are available when explicitly composed", async ({
    nestedOnly,
  }) => {
    expect(nestedOnly).toBe("hello from tests/nested");
  });

  test("parent and sibling directories do not implicitly contribute fixtures", () => {
    expect(() =>
      base("does not inherit parent fixtures", async ({ config }) => {
        expect(config.name).toBe("bun-test-utils");
      }),
    ).toThrow(/unknown fixture "config".*test\.extend/s);

    expect(() =>
      parentOnly("does not see nested fixtures", async ({ nestedOnly }) => {
        expect(nestedOnly).toBe("hello from tests/nested");
      }),
    ).toThrow(/unknown fixture "nestedOnly".*test\.extend/s);
  });

  test("session fixtures are available within an explicit chain", async ({
    events,
  }) => {
    expect(events).toContain("events:setup");
  });

  test("file-scoped fixtures are available in this file", async ({ db }) => {
    expect(db.id).toBeGreaterThan(0);
  });
});

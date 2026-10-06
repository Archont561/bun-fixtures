import { createTest } from "@bun-test-utils/core";
import { withBDDTesting } from "@/index.ts";

const bddTest = withBDDTesting(
  createTest(import.meta.path).test.extend({
    marker: {
      setup: async (use) => {
        await use("bdd");
      },
    },
  }),
);

bddTest
  .scenario("withBDDTesting composes fixtures into fluent scenarios")
  .given("a marker fixture", ({ marker }) => ({ marker }))
  .when("the marker is forwarded", ({ marker }) => ({ marker }))
  .then("the marker is available", ({ marker, expect }) => {
    expect(marker).toBe("bdd");
  });

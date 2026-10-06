import { describe, expect, test } from "@/plugin.ts";

type User = { name: string };

const extended = test.extend({
  api: {
    scope: "test" as const,
    setup: async (use) => {
      await use({ save: async (user: User) => ({ ...user, id: 1 }) });
    },
  },
});

describe("extended scenario chains", () => {
  extended
    .scenario("persists a user")
    .given("a user", () => ({ user: { name: "Ada" } }))
    .given("a request id", () => ({ requestId: "req-1" }))
    .when("the user is saved", async ({ api, user, requestId }) => ({
      saved: await api.save(user),
      requestId,
    }))
    .when("the saved user is labelled", ({ saved }) => ({
      labelled: { ...saved, label: "created" },
    }))
    .then("the saved user has an id", ({ saved, expect }) => {
      expect(saved).toEqual({ name: "Ada", id: 1 });
    })
    .then("the saved user keeps the request id", ({ requestId, expect }) => {
      expect(requestId).toBe("req-1");
    });

  test("extend composes fixtures", async ({ api }) => {
    expect(await api.save({ name: "Grace" })).toEqual({ name: "Grace", id: 1 });
  });
});

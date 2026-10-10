import { describe, expect, test } from "@/plugin.ts";
import type { ScenarioContext } from "@/types.ts";

type User = { name: string };

/**
 * Characterization of the scenario factory's execution semantics (audit
 * 2026-10-06 finding 3 asks for this before plugin.ts is split): the phase
 * order is enforced at declaration, steps run given → when → then, given/when
 * return values merge into the shared context while then's does not, and
 * scenario.prop points at the PBT integration.
 *
 * The scenario registers a real engine test at module scope (collection time),
 * so the plain tests below observe what it did — the same
 * declare-then-observe pattern the env/DOM teardown tests use.
 */

const script: string[] = [];

// The static chain types encode the phase order (out-of-phase methods are
// `never`), so the runtime checks are probed through a fully dynamic view —
// the path a JS consumer or a dynamically built chain takes.
const dynamic = <T>(chain: T): Record<string, (...args: any[]) => any> =>
  chain as never;

test
  .scenario("scenario contract probe")
  .given("an initial state", () => {
    script.push("given");
    return { start: 1 };
  })
  .when("the action runs", ({ start }) => {
    script.push(`when:${start}`);
    return { value: start + 1 };
  })
  .then(
    "the value is observed",
    // Returning a value from then is a type error by design — the type says
    // `void`; the "did not merge" pin below proves the runtime drops it.
    (({ value, expect }: ScenarioContext) => {
      script.push(`then:${value}`);
      expect(value).toBe(2);
      return { injectedByThen: true };
    }) as never,
  )
  .then("the then-phase return did not merge", (ctx) => {
    script.push(`thenSawInjected:${"injectedByThen" in ctx}`);
  });

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

  extended("extend composes fixtures", async ({ api }) => {
    expect(await api.save({ name: "Grace" })).toEqual({ name: "Grace", id: 1 });
  });

  test("base test does not see fixtures from an extended chain", () => {
    expect(() =>
      test("uncomposed scenario fixture", async ({ api }) => {
        expect(await api.save({ name: "Grace" })).toEqual({
          name: "Grace",
          id: 1,
        });
      }),
    ).toThrow(/unknown fixture "api".*test\.extend/s);
  });
});

// Declared at collection time: then() registers a real engine test, which bun
// forbids inside a running test body. The when-after-then phase error is
// captured here and asserted below.
let whenAfterThenError: unknown;
try {
  dynamic(test.scenario("then before when"))
    .then("early", () => {})
    .when("late", () => {});
} catch (error) {
  whenAfterThenError = error;
}

describe("scenario factory contract", () => {
  test("the registered scenario ran given → when → then with context merging", () => {
    expect(script).toEqual([
      "given",
      "when:1",
      "then:2",
      "thenSawInjected:false",
    ]);
  });

  test("given() must precede when() and then()", () => {
    expect(() =>
      dynamic(test.scenario("out of order"))
        .when("early", () => {})
        .given("late", () => {}),
    ).toThrow(
      "[bun-test-utils] scenario given() must precede when() and then()",
    );

    expect((whenAfterThenError as Error)?.message).toBe(
      "[bun-test-utils] scenario when() must precede then()",
    );
  });

  test("scenario.prop requires the property-test integration", () => {
    // The factory-level prop is the core surface; pbt layers its chain-level
    // prop on top of it.
    expect(() => test.scenario.prop("p", {})).toThrow(
      /scenario\.prop\(p\) requires the property-test integration/,
    );
  });
});

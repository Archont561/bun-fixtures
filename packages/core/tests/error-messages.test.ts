import { expect, openFixtures, resolveOrder, test } from "@/plugin.ts";

const contractFile = "/contract/tests/example.test.ts";

function captureError(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error("expected an Error instance");
  }
  throw new Error("expected the operation to throw");
}

async function captureAsyncError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error("expected an Error instance");
  }
  throw new Error("expected the operation to reject");
}

test("unknown fixture message is contractual", () => {
  const error = captureError(() => resolveOrder(["missing"], {}, contractFile));

  expect(error.message).toBe(
    '[bun-test-utils] unknown fixture "missing" requested in /contract/tests/example.test.ts. ' +
      "Available in this explicit test.extend(...) chain: <none>. " +
      "Compose the fixture with test.extend({ missing: ... }) and import that extended test into this file.",
  );
});

test("circular dependency message is contractual", () => {
  const fixtures = {
    alpha: {
      deps: ["beta"],
      setup: async (use: (value: string) => Promise<void>) => {
        await use("alpha");
      },
    },
    beta: {
      deps: ["alpha"],
      setup: async (use: (value: string) => Promise<void>) => {
        await use("beta");
      },
    },
  };

  const error = captureError(() =>
    resolveOrder(["alpha"], fixtures, contractFile),
  );

  expect(error.message).toBe(
    "[bun-test-utils] circular fixture dependency: alpha → beta → alpha (/contract/tests/example.test.ts)",
  );
});

test("missing use(value) message is contractual", async () => {
  const error = await captureAsyncError(() =>
    openFixtures(
      {
        incomplete: {
          setup: async () => {},
        },
      },
      ["incomplete"],
      { testFile: contractFile },
    ),
  );

  expect(error.message).toBe(
    '[bun-test-utils] fixture "incomplete" finished without calling use(value)',
  );
});

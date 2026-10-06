import { describe, expect, test } from "@/index.ts";

const realFetch = globalThis.fetch;
const allowedUrl = "data:text/plain,allowed";

describe("@bun-test-utils/std networkGuard", () => {
  test("rejects unexpected fetch and explicitly allows passthrough", async ({
    networkGuard,
  }) => {
    await expect(fetch("https://unexpected.example/orders")).rejects.toThrow(
      "[bun-test-utils] networkGuard blocked unexpected fetch: GET https://unexpected.example/orders. Allow it explicitly with networkGuard.allow(...).",
    );

    networkGuard.allow(allowedUrl);
    expect(await (await fetch(allowedUrl)).text()).toBe("allowed");
    expect(networkGuard.calls()).toEqual([
      {
        method: "GET",
        url: "https://unexpected.example/orders",
        allowed: false,
      },
      { method: "GET", url: allowedUrl, allowed: true },
    ]);
  });

  test("supports regular-expression and predicate allowlist entries", async ({
    networkGuard,
  }) => {
    networkGuard.allow(
      /^data:text\/plain,/,
      (request: Request) => request.method === "POST",
    );
    expect(await (await fetch("data:text/plain,regex")).text()).toBe("regex");
    expect(await (await fetch(allowedUrl, { method: "POST" })).text()).toBe(
      "allowed",
    );
  });

  test("engine teardown restored fetch", async () => {
    expect(globalThis.fetch).toBe(realFetch);
  });
});

/**
 * The DOM fixtures, composed the way a consumer composes them.
 *
 * `page` declares `document` as a dependency and `document` declares
 * `window`, so asking for `{ page }` alone is enough — the engine resolves
 * the chain, builds each fixture once per test, and tears them down in LIFO
 * order. That is the whole point of this file: no test here names a fixture
 * it does not use, and none of them wires the chain by hand.
 */

import type { DomPageHelper } from "@/index.ts";
import { describe, expect, test } from "@/index.ts";

const originalWindow = (globalThis as unknown as { window?: unknown }).window;

const globals = () => globalThis as unknown as Record<string, unknown>;

describe("@bun-test-utils/dom", () => {
  test("injects window and installs the DOM globals", async ({
    window: win,
  }) => {
    expect(win).toBeDefined();
    expect(globals().document).toBeDefined();
    expect(globals().HTMLElement).toBeDefined();
  });

  test("engine teardown restored the original globals", async () => {
    expect(globals().window).toBe(originalWindow);
  });

  test("resolves the window → document → page chain from one request", async ({
    page,
  }) => {
    // `window` and `document` were never requested here; the engine built
    // them because `page` depends on them.
    expect(globals().document).toBeDefined();

    const helper: DomPageHelper = page;
    let clicked = false;
    helper.mount(`
      <div>
        <input id="name" />
        <button id="btn">Click me</button>
      </div>
    `);

    const btn = helper.querySelector<HTMLButtonElement>("#btn");
    btn?.addEventListener("click", () => {
      clicked = true;
    });

    helper.type("#name", "Ada Lovelace");
    expect(helper.querySelector<HTMLInputElement>("#name")?.value).toBe(
      "Ada Lovelace",
    );

    helper.click("#btn");
    expect(clicked).toBe(true);
  });

  test("engine teardown restored the globals again", async () => {
    expect(globals().window).toBe(originalWindow);
  });
});

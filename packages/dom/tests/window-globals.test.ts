/**
 * Characterization of the `window` fixture's global-state contract (audit
 * 2026-10-06, finding 4).
 *
 * The fixture swaps a fixed list of DOM globals (`window`, `document`, the
 * HTMLElement constructors, …) onto `globalThis` at setup and restores the
 * captured values at teardown. These tests pin that contract:
 *
 * - Restoration survives a consumer that throws.
 * - Overlapping window fixtures nest correctly only in LIFO order: the inner
 *   setup captures the outer fixture's globals as "its originals", so the
 *   inner close hands the globals back to the outer window, and the outer
 *   close finally restores the host.
 * - Out-of-order close leaks the outer fixture's window pointer into the
 *   host — pinned here, not endorsed. The documented assumption is that
 *   test-scoped DOM fixtures run one at a time per file (Bun runs tests in a
 *   file sequentially), or overlap strictly LIFO.
 */

import { describe, expect, test } from "bun:test";
import { openFixtures } from "@bun-test-utils/core";
import { windowFixture } from "@/index.ts";

const globals = () => globalThis as unknown as Record<string, unknown>;

const originalWindow = globals().window;
const originalDocument = globals().document;

function openWindow() {
  return openFixtures({ window: windowFixture }, ["window"]).then(
    ({ fixtures, close }) => ({
      window: fixtures.window,
      close,
    }),
  );
}

describe("window fixture — global-state contract", () => {
  test("teardown restores the host globals after the test body throws", async () => {
    const { close } = await openWindow();

    let caught: unknown;
    try {
      expect(globals().window).not.toBe(originalWindow);
      expect(globals().document).not.toBe(originalDocument);
      throw new Error("consumer exploded");
    } catch (error) {
      caught = error;
    }
    await close();

    expect((caught as Error).message).toBe("consumer exploded");
    expect(globals().window).toBe(originalWindow);
    expect(globals().document).toBe(originalDocument);
  });

  test("overlapping fixtures restore in LIFO order — host globals end up intact", async () => {
    const outer = await openWindow();
    const outerWindow = globals().window;
    const inner = await openWindow();
    const innerWindow = globals().window;

    expect(innerWindow).toBeDefined();
    expect(innerWindow).not.toBe(outerWindow);

    await inner.close();
    expect(globals().window).toBe(outerWindow);
    await outer.close();
    expect(globals().window).toBe(originalWindow);
    expect(globals().document).toBe(originalDocument);
  });

  test("out-of-order close leaks the outer window — the documented concurrency hazard", async () => {
    const outer = await openWindow();
    const outerWindow = globals().window;
    const inner = await openWindow();

    // Host scope closes before the inner scope: the first close restores the
    // host globals, the second then resurrects the value the inner setup
    // captured — the outer fixture's window, already torn down. Pinned
    // deliberately — an out-of-order consumer gets this, per the documented
    // assumption.
    await outer.close();
    expect(globals().window).toBe(originalWindow);
    await inner.close();
    expect(globals().window).toBe(outerWindow);

    // Leave the host exactly as we found it.
    globals().window = originalWindow;
    globals().document = originalDocument;
  });
});

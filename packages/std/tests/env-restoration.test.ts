/**
 * Characterization of the `env` fixture's global-state contract (audit
 * 2026-10-06, finding 4).
 *
 * These tests pin what restoration does today — including the hazard — so the
 * contract is explicit before anything consolidates or changes:
 *
 * - Restoration lives in the fixture's `finally`, so it survives a consumer
 *   that throws.
 * - Each fixture instance snapshots the whole environment at setup and, at
 *   teardown, deletes keys it never saw and restores the values it did.
 * - Two overlapping instances therefore nest correctly only when they close
 *   in LIFO order. Closing out of order lets the inner snapshot's value win:
 *   the first close erases the mutation and the second close resurrects the
 *   value its own snapshot captured. That leak is pinned here, not endorsed —
 *   the documented assumption is one env fixture in flight per process at a
 *   time, or strictly LIFO overlap.
 *
 * Composed through `openFixtures`, the engine's integration entrypoint, so
 * the tests exercise the real setup/teardown path rather than a hand-rolled
 * try/finally.
 */

import { describe, expect, test } from "bun:test";
import { openFixtures } from "@bun-test-utils/core";
import { type EnvHelper, envFixture } from "@/index.ts";

const KEY = "TEST_BUN_TEST_UTILS_ENV_STATE";
const ADDED = "TEST_BUN_TEST_UTILS_ENV_STATE_ADDED";

function openEnv() {
  return openFixtures({ env: envFixture }, ["env"]).then(
    ({ fixtures, close }) => ({
      env: fixtures.env as EnvHelper,
      close,
    }),
  );
}

describe("env fixture — global-state contract", () => {
  test("teardown deletes keys the fixture added and restores values it overwrote", async () => {
    process.env[KEY] = "original";
    const { env, close } = await openEnv();

    env.set(KEY, "changed");
    env.set(ADDED, "added");
    await close();

    expect(process.env[KEY]).toBe("original");
    expect(process.env[ADDED]).toBeUndefined();
    delete process.env[KEY];
  });

  test("restoration survives a consumer that throws after mutating", async () => {
    process.env[KEY] = "original";
    const { env, close } = await openEnv();

    env.set(KEY, "changed");
    let caught: unknown;
    try {
      throw new Error("consumer exploded");
    } catch (error) {
      caught = error;
    }
    // The integration pattern: close() in the failure path, exactly where a
    // try/finally consumer would put it.
    await close();

    expect((caught as Error).message).toBe("consumer exploded");
    expect(process.env[KEY]).toBe("original");
    delete process.env[KEY];
  });

  test("overlapping fixtures restore in LIFO order — the inner close resurrects the outer value", async () => {
    process.env[KEY] = "host";
    const outer = await openEnv();
    outer.env.set(KEY, "outer");
    const inner = await openEnv();
    inner.env.set(KEY, "inner");

    await inner.close();
    expect(process.env[KEY]).toBe("outer");
    await outer.close();
    expect(process.env[KEY]).toBe("host");

    delete process.env[KEY];
  });

  test("out-of-order close leaks the inner value — the documented concurrency hazard", async () => {
    process.env[KEY] = "host";
    const outer = await openEnv();
    outer.env.set(KEY, "outer");
    const inner = await openEnv();
    inner.env.set(KEY, "inner");

    // Host scope closes before the inner scope: the first close erases the
    // mutation, the second close then resurrects the value from the inner
    // snapshot. Pinned deliberately — an overlapping-env consumer that tears
    // down out of order gets this, per the documented assumption.
    await outer.close();
    await inner.close();
    expect(process.env[KEY]).toBe("outer");

    delete process.env[KEY];
  });

  test("a key written after a fixture opened is wiped by that fixture's close", async () => {
    const { close } = await openEnv();

    process.env[KEY] = "sneaky";
    await close();

    expect(process.env[KEY]).toBeUndefined();
  });

  test("snapshot() reflects mutations and is a copy, not a live view", async () => {
    const { env, close } = await openEnv();

    env.set(ADDED, "value");
    const snap = env.snapshot();
    expect(snap[ADDED]).toBe("value");

    env.set(ADDED, "changed");
    expect(snap[ADDED]).toBe("value");

    await close();
  });
});

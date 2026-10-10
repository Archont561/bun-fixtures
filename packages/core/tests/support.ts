/**
 * Shared fixture test doubles for the engine's lifecycle characterization
 * (audit 2026-10-06, finding 5 — extracted now that the lifecycle contract
 * has explicit characterization in plugin.test.ts).
 *
 * Three shapes cover the lifecycle tests: a well-behaved fixture that records
 * its setup/teardown around `use()`, a setup that fails before `use()`, and a
 * teardown that fails after `use()`. Event labels follow the convention the
 * assertions pin: `${name}:setup`, `${name}:teardown` and
 * `${name}:setup-throws`. All are test-scoped — these doubles exercise the
 * engine's unwind machinery, not scope caching (the scope tests build their
 * own session/file fixtures).
 */

import type { FixtureDef } from "@/types.ts";

/**
 * A well-behaved fixture: pushes `${name}:setup` before `use(name)` and
 * `${name}:teardown` after it resolves. Pass no `events` array for a silent
 * double.
 */
export function recordingFixture(
  name: string,
  events?: string[],
): FixtureDef<string> {
  return {
    scope: "test",
    setup: async (use) => {
      events?.push(`${name}:setup`);
      await use(name);
      events?.push(`${name}:teardown`);
    },
  };
}

/**
 * A setup that throws `${message}` before calling `use()` — the setup-failure
 * path. Pushes `${name}:setup-throws` when given an `events` array.
 */
export function brokenFixture(
  name: string,
  message: string,
  events?: string[],
): FixtureDef<never> {
  return {
    scope: "test",
    setup: async () => {
      events?.push(`${name}:setup-throws`);
      throw new Error(message);
    },
  };
}

/**
 * A well-behaved setup whose teardown throws `${message}` after `use()`
 * resolved — the teardown-failure path. Pushes `${name}:teardown` after
 * `use()` and before throwing, when given an `events` array.
 */
export function teardownFailsFixture(
  name: string,
  message: string,
  events?: string[],
): FixtureDef<string> {
  return {
    scope: "test",
    setup: async (use) => {
      await use(name);
      events?.push(`${name}:teardown`);
      throw new Error(message);
    },
  };
}

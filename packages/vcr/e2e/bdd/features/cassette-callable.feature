Feature: Callable cassette callback cache (ADR 0039)
  The callable form is an explicit get-or-record wrapper. A local auto miss
  refreshes a callback source visibly; the next run replays it without work.

  Scenario: an edited callback body refreshes locally and then replays
    Given a project with bun-test-utils preloaded
    And the file "callbacks.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("loads the user", async ({ cassette }) => {
        let calls = 0;
        const loadUser = () => {
          calls++;
          return { id: "u1" };
        };
        expect(await cassette(loadUser)).toEqual({ id: "u1" });
        expect(calls).toBe(1);
      });
      """
    When I run the test suite
    Then 1 test passes
    When I rewrite the file "callbacks.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("loads the user", async ({ cassette }) => {
        let calls = 0;
        const loadUser = () => {
          calls++;
          return { id: "u2" };
        };
        expect(await cassette(loadUser)).toEqual({ id: "u2" });
        expect(calls).toBe(1);
      });
      """
    And I run the test suite
    Then 1 test passes
    And the output contains "cassette(fn) re-recorded callback"
    When I rewrite the file "callbacks.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("loads the user", async ({ cassette }) => {
        let calls = 0;
        const loadUser = () => {
          calls++;
          return { id: "u2" };
        };
        expect(await cassette(loadUser)).toEqual({ id: "u2" });
        expect(calls).toBe(0);
      });
      """
    And I run the test suite
    Then 1 test passes

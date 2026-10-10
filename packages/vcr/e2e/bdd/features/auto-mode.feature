Feature: Auto cassette mode and cache clearing (ADR 0036)
  The default mode records a test on first use and replays it afterwards.
  The test starts its local origin only while recording, so a replay run that
  reached the network would fail.

  Scenario: the first run records, and later runs replay without the network
    Given a project with bun-test-utils preloaded
    And the file "api.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("greeting", async ({ cassette }) => {
        const server =
          cassette.mode === "record"
            ? Bun.serve({ port: 47931, fetch: () => new Response("hello") })
            : undefined;
        try {
          const res = await fetch("http://127.0.0.1:47931/greeting");
          expect(await res.text()).toBe("hello");
        } finally {
          server?.stop(true);
        }
      });
      """
    When I run the test suite
    Then 1 test passes
    And the file "__cassettes__/greeting.json" exists
    When I run the test suite
    Then 1 test passes

  Scenario: a request missing from a present cassette fails with the clear command
    Given a project with bun-test-utils preloaded
    And the file "api.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("greeting", async ({ cassette }) => {
        const server =
          cassette.mode === "record"
            ? Bun.serve({ port: 47931, fetch: () => new Response("hello") })
            : undefined;
        try {
          const res = await fetch("http://127.0.0.1:47931/greeting");
          expect(await res.text()).toBe("hello");
        } finally {
          server?.stop(true);
        }
      });
      """
    When I run the test suite
    Then 1 test passes
    When I rewrite the file "api.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("greeting", async ({ cassette }) => {
        expect(cassette.mode).toBe("replay");
        const res = await fetch("http://127.0.0.1:47931/farewell");
        expect(await res.text()).toBe("bye");
      });
      """
    And I run the test suite
    Then the test run fails
    And the output contains "auto mode replays it and does not record"
    And the output contains "cache clear --file \"api.test.ts\" --test \"greeting\""

  Scenario: CI refuses to record a missing cassette
    Given a project with bun-test-utils preloaded
    And the file "api.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("greeting", async ({ cassette }) => {
        expect(cassette.path).toContain("greeting.json");
      });
      """
    When I run the test suite with CI set
    Then the test run fails
    And the output contains "CI is set"
    And the file "__cassettes__/greeting.json" does not exist

  Scenario: a failed first run writes no cassette
    Given a project with bun-test-utils preloaded
    And the file "api.test.ts":
      """
      import { test } from "@archont561/bun-test-utils";

      test("greeting", async () => {
        const server = Bun.serve({ port: 47931, fetch: () => new Response("hello") });
        try {
          await fetch("http://127.0.0.1:47931/greeting");
          throw new Error("the body fails after a request");
        } finally {
          server.stop(true);
        }
      });
      """
    When I run the test suite
    Then the test run fails
    And the file "__cassettes__/greeting.json" does not exist

  Scenario: clearing one test deletes its cassette, and the next run records it again
    Given a project with bun-test-utils preloaded
    And the file "api.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("greeting", async ({ cassette }) => {
        const server =
          cassette.mode === "record"
            ? Bun.serve({ port: 47931, fetch: () => new Response("hello") })
            : undefined;
        try {
          const res = await fetch("http://127.0.0.1:47931/greeting");
          expect(await res.text()).toBe("hello");
        } finally {
          server?.stop(true);
        }
      });
      """
    When I run the test suite
    Then 1 test passes
    When I run "cache clear --file api.test.ts --test greeting --dry-run"
    Then the command succeeds
    And the output contains "would remove __cassettes__/greeting.json"
    And the file "__cassettes__/greeting.json" exists
    When I run "cache clear --file api.test.ts --test greeting"
    Then the command succeeds
    And the output contains "Deleted 1 file(s)"
    And the file "__cassettes__/greeting.json" does not exist
    When I run the test suite
    Then 1 test passes
    And the file "__cassettes__/greeting.json" exists

  Scenario: cache clear without a scope is a usage error
    Given a project with bun-test-utils preloaded
    When I run "cache clear"
    Then the command fails
    And the output contains "Choose a scope"

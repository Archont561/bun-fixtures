Feature: Callback results persist across runs (ADR 0035)
  Scenario: a later run replays the callback recorded by an earlier run
    Given a project with bun-test-utils preloaded
    And the file "callbacks.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("loads the user", async ({ cassette }) => {
        const loadUser = () => ({ id: "u1" });
        const value =
          cassette.mode === "replay"
            ? await cassette.replay(loadUser)
            : await cassette.record(loadUser);
        expect(value).toEqual({ id: "u1" });
      });
      """
    When I run the test suite with VCR_MODE set to "record"
    Then 1 test passes
    And the file "__cassettes__/loads-the-user.callbacks.json" exists
    When I run the test suite with VCR_MODE set to "replay"
    Then 1 test passes

  Scenario: a changed callback body is not replayed from the earlier run
    Given a project with bun-test-utils preloaded
    And the file "callbacks.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("loads the user", async ({ cassette }) => {
        const loadUser = () => ({ id: "u1" });
        const value =
          cassette.mode === "replay"
            ? await cassette.replay(loadUser)
            : await cassette.record(loadUser);
        expect(value).toEqual({ id: "u1" });
      });
      """
    When I run the test suite with VCR_MODE set to "record"
    Then 1 test passes
    When I rewrite the file "callbacks.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("loads the user", async ({ cassette }) => {
        const loadUser = () => ({ id: "u2" });
        const value =
          cassette.mode === "replay"
            ? await cassette.replay(loadUser)
            : await cassette.record(loadUser);
        expect(value).toEqual({ id: "u2" });
      });
      """
    And I run the test suite with VCR_MODE set to "replay"
    Then the test run fails
    And the output contains "loads-the-user.callbacks.json"

Feature: VCR fixtures
  Scenario: Root test exposes cassettes
    Given a project with bun-test-utils preloaded
    And the file "vcr.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("records and replays callback output", async ({ cassette }) => {
        let calls = 0;
        const load = () => {
          calls++;
          return { ok: true };
        };
        expect(await cassette.record(load)).toEqual({ ok: true });
        expect(await cassette.replay(load)).toEqual({ ok: true });
        expect(calls).toBe(1);
      });
      """
    When I run the test suite
    Then 1 test passes

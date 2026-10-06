Feature: Built-in capability behaviour
  As a consumer of bun-test-utils
  I want built-in fixtures and advanced runners exercised through the root API
  So that packaging and fixture composition regressions are caught without public subpaths

  @std
  Scenario: Standard fixtures isolate files and environment variables
    Given a project with bun-test-utils preloaded
    And the file "std.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("uses the temporary directory and restores the environment", async ({ tmpdir, env }) => {
        env.set("PACK_MODE", "test");
        expect(env.get("PACK_MODE")).toBe("test");
        tmpdir.write("nested/value.txt", "hello");
        expect(tmpdir.read("nested/value.txt")).toBe("hello");
        expect(tmpdir.exists("nested")).toBe(true);
      });
      """
    When I run the test suite
    Then 1 test passes

  @pbt @property
  Scenario: PBT generates examples through test.prop
    Given a project with bun-test-utils preloaded
    And the file "pbt.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test.prop("array concatenation preserves length", (fc) => ({ left: fc.array(fc.integer(), { maxLength: 5 }), right: fc.array(fc.integer(), { maxLength: 5 }) }), async (_ctx, { left, right }) => {
        expect([...left, ...right]).toHaveLength(left.length + right.length);
      }, { numRuns: 20, seed: 20261006 });
      """
    When I run the test suite
    Then 1 test passes

  @dom
  Scenario: DOM fixtures mount and interact with markup
    Given a project with bun-test-utils preloaded
    And the file "dom.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("mounts markup and dispatches clicks", async ({ page }) => {
        page.mount(`<button id="add">add</button><span id="count">0</span>`);
        page.querySelector("#add")!.addEventListener("click", () => {
          page.querySelector("#count")!.textContent = "1";
        });
        page.click("#add");
        expect(page.html()).toContain(">1</span>");
      });
      """
    When I run the test suite
    Then 1 test passes

  @browser
  Scenario: Browser server fixture serves a response
    Given a project with bun-test-utils preloaded
    And the file "browser.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("serves through the ephemeral test server", async ({ testServer, serverUrl }) => {
        testServer.handle(() => Response.json({ status: "ok" }));
        const response = await fetch(serverUrl);
        expect(await response.json()).toEqual({ status: "ok" });
      });
      """
    When I run the test suite
    Then 1 test passes

  @vcr
  Scenario: VCR callback recording replays without repeating work
    Given a project with bun-test-utils preloaded
    And the file "vcr.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("records and replays callback results", async ({ cassette }) => {
        let calls = 0;
        const load = () => {
          calls++;
          return { id: "user-1" };
        };
        expect(await cassette.record(load)).toEqual({ id: "user-1" });
        expect(await cassette.replay(load)).toEqual({ id: "user-1" });
        expect(calls).toBe(1);
      });
      """
    When I run the test suite
    Then 1 test passes

  @snapshot
  Scenario: Snapshot fixture records and matches a value
    Given a project with bun-test-utils preloaded
    And the file "snapshot.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("records a stable value", async ({ snapshot }) => {
        snapshot.setMode("match");
        snapshot.match({ component: "card", count: 2 }, "card");
        expect(snapshot.mode).toBe("match");
      });
      """
    When I run the test suite
    Then 1 test passes

  @bdd
  Scenario: BDD-style scenario chains receive fixtures from test context
    Given a project with bun-test-utils preloaded
    And the file "bdd.test.ts":
      """
      import { test } from "bun-test-utils";

      test.scenario("fixtures flow through a fluent scenario")
        .given("a file", async ({ tmpdir }) => {
          tmpdir.write("answer.txt", "42");
          return { file: "answer.txt" };
        })
        .when("the file is read", ({ tmpdir, file }) => ({ value: tmpdir.read(file) }))
        .then("the value is asserted", ({ value, expect }) => {
          expect(value).toBe("42");
        });
      """
    When I run the test suite
    Then 1 test passes

  @scenario
  Scenario: Fluent scenarios allow multiple givens whens and thens
    Given a project with bun-test-utils preloaded
    And the file "scenario.test.ts":
      """
      import { test } from "bun-test-utils";

      test.scenario("chains every fluent phase")
        .given("a base value", () => ({ value: 2 }))
        .given("a label", () => ({ label: "answer" }))
        .when("the value is incremented", ({ value }) => ({ result: value + 1 }))
        .when("the result is formatted", ({ result, label }) => ({ formatted: `${label}:${result}` }))
        .then("the number is correct", ({ result, expect: scenarioExpect }) => {
          scenarioExpect(result).toBe(3);
        })
        .then("the formatted value is correct", ({ formatted, expect: scenarioExpect }) => {
          scenarioExpect(formatted).toBe("answer:3");
        });
      """
    When I run the test suite
    Then 1 test passes

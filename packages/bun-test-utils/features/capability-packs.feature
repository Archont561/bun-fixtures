Feature: Capability pack behaviour
  As a consumer of bun-test-utils
  I want each bundled capability pack exercised through its public subpath
  So that packaging and fixture composition regressions are caught

  @std
  Scenario: Standard fixtures isolate files and environment variables
    Given a project with bun-test-utils preloaded
    And the file "std.test.ts":
      """
      import { expect } from "bun:test";
      import { test } from "bun-test-utils/std";

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
  Scenario: PBT generates examples through the public subpath
    Given a project with bun-test-utils preloaded
    And the file "pbt.test.ts":
      """
      import { expect } from "bun:test";
      import { fc, test } from "bun-test-utils/pbt";

      test.prop("array concatenation preserves length", { left: fc.array(fc.integer(), { maxLength: 5 }), right: fc.array(fc.integer(), { maxLength: 5 }) }, async (_ctx, { left, right }) => {
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
      import { expect } from "bun:test";
      import { test } from "bun-test-utils/dom";

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
      import { expect } from "bun:test";
      import { test } from "bun-test-utils/browser";

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
      import { expect } from "bun:test";
      import { test } from "bun-test-utils/vcr";

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
      import { expect } from "bun:test";
      import { test } from "bun-test-utils/snapshot";

      test("records a stable value", async ({ snapshot }) => {
        snapshot.setMode("match");
        snapshot.match({ component: "card", count: 2 }, "card");
        expect(snapshot.mode).toBe("match");
      });
      """
    When I run the test suite
    Then 1 test passes

  @bdd
  Scenario: BDD bridge attaches and tears down scenario fixtures
    Given a project with bun-test-utils preloaded
    And the file "bdd.test.ts":
      """
      import { expect, test } from "bun:test";
      import { fixtureSteps } from "bun-test-utils/bdd";

      test("connects fixture hooks to a world", async () => {
        let beforeHook;
        let afterHook;
        const hooks = {
          Before(fn) { beforeHook = fn; },
          After(fn) { afterHook = fn; },
        };
        const events = [];
        fixtureSteps(hooks, { answer: { setup: async (use) => { events.push("setup"); await use(42); events.push("teardown"); } } }, ["answer"]);
        const world = {};
        await beforeHook(world);
        expect(world.answer).toBe(42);
        await afterHook(world);
        expect(events).toEqual(["setup", "teardown"]);
      });
      """
    When I run the test suite
    Then 1 test passes

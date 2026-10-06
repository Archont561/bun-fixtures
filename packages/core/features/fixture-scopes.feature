Feature: Fixture scopes
  As a developer migrating from pytest
  I want fixtures that live for a session, a file, or a single test
  So that expensive setup is shared exactly as far as it is safe to share it

  Background:
    Given a project with bun-test-utils preloaded

  Scenario: A session fixture is built once for the whole run
    Given the file "fixtures.ts":
      """
      export default {
        server: {
          scope: "session",
          setup: async (use) => {
            console.log("server:setup");
            await use({ port: 1234 });
            console.log("server:teardown");
          },
        },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("a uses the server", async ({ server }) => {
        expect(server.port).toBe(1234);
      });
      """
    And the file "b.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("b uses the same server", async ({ server }) => {
        expect(server.port).toBe(1234);
      });
      """
    When I run the test suite
    Then 2 tests pass
    And the output contains "server:setup" 1 time
    And "server:setup" comes before "server:teardown"

  Scenario: A file fixture is rebuilt for each test file
    Given the file "fixtures.ts":
      """
      let n = 0;
      export default {
        db: {
          scope: "file",
          setup: async (use) => {
            console.log(`db:setup:${++n}`);
            await use({ id: n });
            console.log(`db:teardown:${n}`);
          },
        },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("first test in file a", async ({ db }) => { expect(db.id).toBe(1); });
      test("second test in file a", async ({ db }) => { expect(db.id).toBe(1); });
      """
    And the file "b.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("first test in file b", async ({ db }) => { expect(db.id).toBe(2); });
      """
    When I run the test suite
    Then 3 tests pass
    And the output contains "db:setup:1" 1 time
    And the output contains "db:setup:2" 1 time
    And "db:teardown:1" comes before "db:setup:2"

  Scenario: A test fixture is rebuilt for every test
    Given the file "fixtures.ts":
      """
      export default {
        tmp: {
          setup: async (use) => {
            console.log("tmp:setup");
            await use({});
            console.log("tmp:teardown");
          },
        },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("one", async ({ tmp }) => { expect(tmp).toBeDefined(); });
      test("two", async ({ tmp }) => { expect(tmp).toBeDefined(); });
      """
    When I run the test suite
    Then 2 tests pass
    And the output contains "tmp:setup" 2 times
    And the output contains "tmp:teardown" 2 times

  Scenario: Teardown runs last-in-first-out
    Given the file "fixtures.ts":
      """
      export default {
        outer: {
          setup: async (use) => {
            console.log("outer:setup");
            await use("outer");
            console.log("outer:teardown");
          },
        },
        inner: {
          setup: async (use, { outer }) => {
            console.log("inner:setup");
            await use(`inner-of-${outer}`);
            console.log("inner:teardown");
          },
        },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("nested fixtures", async ({ inner }) => {
        expect(inner).toBe("inner-of-outer");
      });
      """
    When I run the test suite
    Then 1 test passes
    And "outer:setup" comes before "inner:setup"
    And "inner:teardown" comes before "outer:teardown"

  Scenario: A failing test still tears its fixtures down
    Given the file "fixtures.ts":
      """
      export default {
        resource: {
          setup: async (use) => {
            await use("held");
            console.log("resource:released");
          },
        },
      };
      """
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("fails on purpose", async ({ resource }) => {
        expect(resource).toBe("something else");
      });
      """
    When I run the test suite
    Then the test run fails
    And the output contains "resource:released" 1 time

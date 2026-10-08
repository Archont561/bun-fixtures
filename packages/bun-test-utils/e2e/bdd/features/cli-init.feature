Feature: Project setup with the CLI
  As a developer starting out
  I want one command to wire bun-test-utils into my project
  So that I can write my first fixture test immediately

  Background:
    Given a project without bunfig.toml

  Scenario: Initializing a fresh project
    When I run "init"
    Then the file "bunfig.toml" contains "./node_modules/@archont561/bun-test-utils/dist/plugin.js"
    And the file "bunfig.toml" exists
    And the command succeeds

  Scenario: Initializing twice does not duplicate the preload entry
    When I run "init"
    And I run "init"
    Then "bunfig.toml" contains "dist/plugin.js" 1 time
    And the output contains "already preloads"

  Scenario: Existing configuration survives
    Given the file "bunfig.toml":
      """
      [install]
      registry = "https://registry.npmjs.org"

      [test]
      preload = ["./other-preload.ts"]
      """
    When I run "init"
    Then the file "bunfig.toml" contains "./other-preload.ts"
    And the file "bunfig.toml" contains "registry"
    And the file "bunfig.toml" contains "./node_modules/@archont561/bun-test-utils/dist/plugin.js"

  Scenario: An existing test.ts is never clobbered by accident
    Given the file "test.ts":
      """
      export const mine = 1;
      """
    When I run "init"
    Then the file "test.ts" contains "mine"
    And the output contains "created bunfig.toml"

  Scenario: The initialized project runs its first explicit fixture test
    When I run "init"
    And the file "a.test.ts":
      """
      import { test as base, expect } from "@archont561/bun-test-utils";
      const test = base.extend({ config: { setup: async (use) => { await use({ env: "test" }); } } });
      test("the explicit fixture works", async ({ config }) => {
        expect(config.env).toBe("test");
      });
      """
    And I run the test suite
    Then 1 test passes

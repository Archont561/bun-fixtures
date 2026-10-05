Feature: Project setup with the CLI
  As a developer starting out
  I want one command to wire bun-test-utils into my project
  So that I can write my first fixture test immediately

  Background:
    Given a project without bunfig.toml

  Scenario: Initializing a fresh project
    When I run "init"
    Then the file "bunfig.toml" contains "./node_modules/bun-test-utils/src/plugin.ts"
    And the file "fixtures.ts" exists
    And the command succeeds

  Scenario: Initializing twice does not duplicate the preload entry
    When I run "init"
    And I run "init"
    Then "bunfig.toml" contains "plugin.ts" 1 time
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
    And the file "bunfig.toml" contains "./node_modules/bun-test-utils/src/plugin.ts"

  Scenario: An existing fixtures.ts is never clobbered by accident
    Given the file "fixtures.ts":
      """
      export default { mine: { setup: async (use) => { await use(1); } } };
      """
    When I run "init"
    Then the file "fixtures.ts" contains "mine"
    And the output contains "left untouched"

  Scenario: The scaffolded project runs its first test
    When I run "init"
    And the file "a.test.ts":
      """
      import { test, expect } from "bun-test-utils";
      test("the scaffolded fixture works", async ({ config }) => {
        expect(config.env).toBe("test");
      });
      """
    And I run the test suite
    Then 1 test passes

Feature: DOM fixtures
  Scenario: Root test exposes happy-dom page helpers
    Given a project with bun-test-utils preloaded
    And the file "dom.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("uses the DOM page fixture", async ({ page }) => {
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

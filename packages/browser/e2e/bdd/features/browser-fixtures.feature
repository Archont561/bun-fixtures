Feature: Browser and web fixtures
  Scenario: Root test exposes a selectable webPage
    Given a project with bun-test-utils preloaded
    And the file "browser.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("uses webPage in DOM mode", async ({ webPage }) => {
        expect(webPage.mode).toBe("dom");

        await webPage.setContent(`<button id="save">save</button><span id="state">idle</span>`);
        webPage.raw.document.querySelector("#save")!.addEventListener("click", () => {
          webPage.raw.document.querySelector("#state")!.textContent = "saved";
        });
        await webPage.click("#save");
        expect(await webPage.textContent("#state")).toBe("saved");
      });
      """
    When I run the test suite
    Then 1 test passes

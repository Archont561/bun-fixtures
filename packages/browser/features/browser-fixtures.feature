Feature: Browser and web fixtures
  Scenario: Root test exposes selectable webPage and MSW-like HTTP mocks
    Given a project with bun-test-utils preloaded
    And the file "browser.test.ts":
      """
      import { expect, test } from "bun-test-utils";

      test("uses webPage in DOM mode and httpMock", async ({ webPage, httpMock }) => {
        expect(webPage.mode).toBe("dom");
        httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
        const response = await fetch("https://example.test/api/user");
        expect(await response.json()).toEqual({ name: "Ada" });
        expect(httpMock.calls()[0].handled).toBe(true);

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

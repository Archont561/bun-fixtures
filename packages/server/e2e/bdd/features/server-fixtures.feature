Feature: Server fixtures
  Scenario: Root test exposes MSW-like HTTP mocks
    Given a project with bun-test-utils preloaded
    And the file "server.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test("mocks a response with httpMock", async ({ httpMock }) => {
        httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
        const response = await fetch("https://example.test/api/user");
        expect(await response.json()).toEqual({ name: "Ada" });
        expect(httpMock.calls()[0].handled).toBe(true);
      });
      """
    When I run the test suite
    Then 1 test passes

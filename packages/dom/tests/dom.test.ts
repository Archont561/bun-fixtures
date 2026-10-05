import { describe, expect, test } from "bun:test";
import { documentFixture, pageFixture, windowFixture } from "../src/index.ts";

describe("@bun-fixture/dom", () => {
  test("initializes window and restores globals upon teardown", async () => {
    const origWindow = (globalThis as any).window;
    await windowFixture.setup(
      async (win) => {
        expect(win).toBeDefined();
        expect((globalThis as any).document).toBeDefined();
        expect((globalThis as any).HTMLElement).toBeDefined();
      },
      { testFile: import.meta.path },
    );
    expect((globalThis as any).window).toBe(origWindow);
  });

  test("mounts elements, types and handles events via page helper", async () => {
    await windowFixture.setup(
      async (win) => {
        await documentFixture.setup(
          async (doc) => {
            await pageFixture.setup(
              async (page) => {
                let clicked = false;
                page.mount(`
                  <div>
                    <input id="name" />
                    <button id="btn">Click me</button>
                  </div>
                `);

                const btn = page.querySelector<HTMLButtonElement>("#btn");
                btn?.addEventListener("click", () => {
                  clicked = true;
                });

                page.type("#name", "Ada Lovelace");
                expect(
                  page.querySelector<HTMLInputElement>("#name")?.value,
                ).toBe("Ada Lovelace");

                page.click("#btn");
                expect(clicked).toBe(true);
              },
              { testFile: import.meta.path, window: win, document: doc },
            );
          },
          { testFile: import.meta.path, window: win },
        );
      },
      { testFile: import.meta.path },
    );
  });
});

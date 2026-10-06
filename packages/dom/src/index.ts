import {
  BunTestUtilsError,
  test as baseTest,
  createFixture,
  type FixtureMap,
  MissingOptionalDependencyError,
} from "@bun-test-utils/core";
import type { GlobalWindow } from "happy-dom";

export interface DomPageHelper {
  /** Mounts an HTML string to document.body and returns the container or child. */
  mount(html: string): HTMLElement;
  /** Selects a single element matching CSS selector. */
  querySelector<T extends Element = Element>(selector: string): T | null;
  /** Selects all elements matching CSS selector. */
  querySelectorAll<T extends Element = Element>(
    selector: string,
  ): NodeListOf<T>;
  /** Dispatches a click event on an element matching selector. */
  click(selector: string): void;
  /** Simulates typing into an input matching selector. */
  type(selector: string, text: string): void;
  /** Returns the innerHTML of document.body. */
  html(): string;
  /** Clears document.body. */
  clear(): void;
}

const GLOBAL_PROPERTIES = [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLDivElement",
  "Node",
  "Element",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "customElements",
  "navigator",
] as const;

export const windowFixture = createFixture<GlobalWindow>({
  scope: "test",
  setup: async (use) => {
    // `happy-dom` is an optional peer of the published `bun-test-utils`
    // package (see its package.json) — it is not force-installed for
    // consumers who never request this fixture. A lazy import, rather than a
    // static one, turns a missing dependency into this clear, actionable
    // error instead of Bun's generic module-resolution failure.
    let GlobalWindowCtor: typeof GlobalWindow;
    try {
      ({ GlobalWindow: GlobalWindowCtor } = await import("happy-dom"));
    } catch {
      throw new MissingOptionalDependencyError(
        "happy-dom",
        "bun add -d happy-dom",
        "[bun-test-utils/dom] 'happy-dom' is required for DOM fixtures. Install via 'bun add -d happy-dom'.",
      );
    }
    const win = new GlobalWindowCtor({ url: "http://localhost" });
    const originalGlobals = new Map<string, any>();
    const g = globalThis as any;

    for (const prop of GLOBAL_PROPERTIES) {
      if (prop in g) {
        originalGlobals.set(prop, g[prop]);
      }
      if (prop in win) {
        g[prop] = (win as any)[prop];
      }
    }

    try {
      await use(win);
    } finally {
      await win.happyDOM.abort();
      await win.happyDOM.close();

      for (const prop of GLOBAL_PROPERTIES) {
        if (originalGlobals.has(prop)) {
          g[prop] = originalGlobals.get(prop);
        } else {
          delete g[prop];
        }
      }
    }
  },
});

export const documentFixture = createFixture<Document>({
  scope: "test",
  deps: ["window"],
  setup: async (use, { window }) => {
    await use((window as GlobalWindow).document as unknown as Document);
  },
});

export const pageFixture = createFixture<DomPageHelper>({
  scope: "test",
  deps: ["window", "document"],
  setup: async (use, { document }) => {
    const doc = document as Document;

    const helper: DomPageHelper = {
      mount(html: string) {
        doc.body.innerHTML = html;
        return doc.body.firstElementChild as HTMLElement;
      },
      querySelector<T extends Element = Element>(selector: string) {
        return doc.querySelector<T>(selector);
      },
      querySelectorAll<T extends Element = Element>(selector: string) {
        return doc.querySelectorAll<T>(selector);
      },
      click(selector: string) {
        const el = doc.querySelector<HTMLElement>(selector);
        if (!el)
          throw new BunTestUtilsError(
            "INVALID_API_USAGE",
            `[bun-test-utils/dom] element "${selector}" not found`,
            { details: { selector } },
          );
        el.dispatchEvent(
          new (globalThis as any).MouseEvent("click", { bubbles: true }),
        );
      },
      type(selector: string, text: string) {
        const el = doc.querySelector<HTMLInputElement>(selector);
        if (!el)
          throw new BunTestUtilsError(
            "INVALID_API_USAGE",
            `[bun-test-utils/dom] input "${selector}" not found`,
            { details: { selector } },
          );
        el.value = text;
        el.dispatchEvent(
          new (globalThis as any).Event("input", { bubbles: true }),
        );
        el.dispatchEvent(
          new (globalThis as any).Event("change", { bubbles: true }),
        );
      },
      html() {
        return doc.body.innerHTML;
      },
      clear() {
        doc.body.innerHTML = "";
      },
    };

    await use(helper);
  },
});

export const domFixtures: FixtureMap = {
  window: windowFixture,
  document: documentFixture,
  page: pageFixture,
};

/** Playwright-style test preconfigured with the DOM fixtures. */
export const test = baseTest.extend(domFixtures);

export default domFixtures;

/** Internal error re-exports for workspace-local tests and adapters. */
export { BunTestUtilsError, MissingOptionalDependencyError };

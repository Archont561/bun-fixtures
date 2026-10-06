# @bun-test-utils/dom

> **Internal workspace.** Bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as the
> `bun-test-utils/dom` subpath; never published on its own.

In-memory DOM testing with [happy-dom](https://github.com/capricorn86/happy-dom): isolated
`window` and `document` globals plus a `page` helper for mounting markup and driving
interactions. All DOM globals the fixtures install are **removed again on teardown**, so
one test's `document` never leaks into the next (spec 0011 R1–R2).

For real-browser automation see [`@bun-test-utils/browser`](../browser). For serving pages
to either of them, `browser` also ships the ephemeral `testServer` fixture.

## Peer dependency

`happy-dom` is an optional dependency — install it yourself if your package manager
skipped it:

```bash
bun add -d happy-dom
```

Importing this subpath without it installed throws a clear error naming the missing
package; it never fails silently.

## Fixtures

| Fixture | Helper | What it does |
| --- | --- | --- |
| `window` | happy-dom `Window` | Fresh isolated window per test; `globalThis.window` restored on teardown |
| `document` | happy-dom `Document` | The window's document; `globalThis.document` restored on teardown |
| `page` | `DomPageHelper` | High-level mount/query/interact wrapper over the document |

### `DomPageHelper`

```ts
import domFixtures, { pageFixture } from "bun-test-utils/dom";

test("increments", async ({ page }) => {
  page.mount(`<button id="inc">++</button><span id="count">0</span>`);
  page.click("#inc");
  page.type("#name", "ada");          // types into an input
  page.querySelector("#count");       // single element, or null
  page.querySelectorAll("button");    // all matches
  expect(page.html()).toContain("1"); // document.body innerHTML
  page.clear();                       // empties document.body
});
```

The default `domFixtures` map registers `window`, `document`, and `page` together — merge
it into your `fixtures.ts` like any other `FixtureMap`.

## Further reading

- Spec: [0011 DOM and browser fixtures](../../.backlog/docs/specs/0011-dom-and-browser-fixtures.md)
- Sources in `src/`, focused tests in `tests/`

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.

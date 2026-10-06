# @bun-test-utils/browser

> **Internal workspace.** Bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as the
> `bun-test-utils/browser` subpath; never published on its own.

Real-browser and web-server testing fixtures: an ephemeral `Bun.serve` test server on a
random free port, plus [Playwright](https://playwright.dev) `browser` / `browserContext` /
`browserPage` fixtures with per-test isolation (spec 0011 R3–R5).

For in-memory DOM testing without a browser binary, see [`@bun-test-utils/dom`](../dom).

## Peer dependency

`playwright` is an optional dependency. You need both the library **and** a browser binary:

```bash
bun add -d playwright
bunx playwright install chromium   # downloads the Chromium binaries
```

Importing this subpath without the library installed throws a clear error naming the
missing package and the install command — it never fails silently (covered by
`tests/playwright-missing-peer.test.ts`).

## Fixtures

| Fixture | Scope | What it does |
| --- | --- | --- |
| `testServer` | test | `Bun.serve({ port: 0 })` — a fresh ephemeral server per test, stopped on teardown |
| `serverUrl` | test | The server's `http://localhost:<port>` URL (depends on `testServer`) |
| `browser` | session | One headless Chromium for the whole run, closed after the run |
| `browserContext` | test | Fresh Playwright context per test — isolated cookies and storage |
| `browserPage` | test | A page inside the test's context, closed on teardown |

### `TestServerHelper`

```ts
test("serves an API", async ({ testServer, serverUrl }) => {
  testServer.handle((req) => {
    const url = new URL(req.url);
    return url.pathname === "/api/health"
      ? Response.json({ status: "healthy" })
      : new Response("Not Found", { status: 404 });
  });

  expect(await (await fetch(`${serverUrl}/api/health`)).json()).toEqual({ status: "healthy" });
  // server stops when the test ends; `testServer.port` is the chosen free port
});
```

### End-to-end against the server

```ts
test("clicks increment", async ({ browserPage, serverUrl }) => {
  await browserPage.goto(serverUrl);
  await browserPage.click("#inc");
  expect(await browserPage.textContent("#count")).toBe("1");
});
```

Contexts are created per test from the shared session browser, so cookies set in one test
are invisible to the next even against the same origin — verified by end-to-end tests in
`tests/playwright.test.ts`.

## Tests and browsers

The package's Playwright E2E tests need browser binaries
(`bunx playwright install chromium`) and **skip gracefully** when none are installed, so
contributors without the optional peer stay green. CI installs the Chromium headless shell,
so the coverage is real on every push. The `testServer` tests always run.

## Further reading

- Spec: [0011 DOM and browser fixtures](../../.backlog/docs/specs/0011-dom-and-browser-fixtures.md)
- Sources in `src/`, tests in `tests/`

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.

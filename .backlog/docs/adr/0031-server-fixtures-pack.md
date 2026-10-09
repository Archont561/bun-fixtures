# 0031 — Server fixtures pack: testServer, serverUrl, httpMock leave browser

- **Status:** accepted, amends [0013](./0013-published-wrapper-internal-workspaces.md)
- **Date:** 2026-10-09

## Context

`packages/browser` mixes two concepts. Its browser automation fixtures
(`browser`, `browserContext`, `browserPage`, `webPage`, `browserHttpMock`) are
genuinely browser-shaped: they load Playwright, or select the dom-vs-browser
backend for `webPage`. But `testServer`, `serverUrl`, and `httpMock` never
load Playwright at all — they are an ephemeral `Bun.serve` on a random port
and an MSW-like fetch interceptor, i.e. API-test fixtures that happen to live
in the browser pack because that is where the web story started.

The cost is structural, not cosmetic. A consumer — or an internal suite —
that only needs an HTTP server pulls a pack whose description, optional
dependency, and test tree are all browser-shaped, and the pack graph suggests
API tests need Playwright as a matter of structure rather than by accident of
history. ADR 0013 already establishes private sibling workspaces composed
flatly by the root wrapper; this decision applies that pattern one boundary
further.

## Decision

Move `testServerFixture`, `serverUrlFixture`, `httpMockFixture` and their
types (`TestServerHelper`, `HttpMockHelper`) into a new private workspace
`packages/server` (`@bun-test-utils/server`).

- **Siblings on core, not parent-child.** `installFetchInterceptor` and
  `matchesFetch` already live in `@bun-test-utils/core`, so the server pack
  needs no import from browser, and browser needs none from server for its
  own fixtures. The shared HTTP primitives stay where they are.
- **Browser keeps its two real seams.** `browserHttpMock` (the Playwright
  route adapter that fulfils mocked responses inside a browser context) and
  `webPage` (whose seam is dom-vs-browser, not http) stay in
  `@bun-test-utils/browser`.
- **Composition stays at the root.** The root `plugin.ts` adds
  `...serverFixtures` to the flat namespace. The nineteen public fixture
  names, the root runtime API (`describe`, `expect`, `test`), and the export
  map (`.`, `./bdd`, `./snap`, `./pbt`, `./package.json`) are unchanged. No
  new public subpath, no re-export facade from browser, and no changeset
  (pre-0.1.0 policy).

Spec 0011 keeps R5 verbatim; only its Implementation line gains
`packages/server/`.

## Consequences

**Good**

- API tests never load Playwright as structure. `packages/server` declares no
  Playwright dependency, and its suite proves that by running with Playwright
  absent from its tree.
- `packages/browser` shrinks to the fixtures that are actually about a
  browser; the httpMock scenario moves to the server pack's behavioural
  suite, where it runs without any browser binary.
- The public surface does not move at all: same fixture names, same root
  exports, same bundled `dist/plugin.js` (the root bunup config's
  `bundledWorkspaces` list gains one entry).

**Trade-offs**

- One more internal workspace to scaffold and mirror (package.json,
  tsconfig, bunup config, scripts, README, e2e/bdd layout).
- `browserHttpMock` still needs an `HttpMockHelper` instance; how it obtains
  one (server-exported state factory vs composing the server fixture) is an
  implementation detail of the extraction, not part of this decision.

## Alternatives considered

- **Fold `httpMock` into the VCR pack:** rejected — different lifecycle.
  Cassettes record and replay persisted interactions across runs; httpMock
  stubs in-memory handlers per test with no persistence.
- **Keep the fixtures in browser and rely on convention:** rejected — the
  point of the move is that the dependency is structural. A comment does not
  stop an API test from installing Playwright.
- **Parent-child (browser depends on server, or server on browser):**
  rejected — the shared primitives already live in core, so neither pack
  needs the other for its own fixtures; the root wrapper composes them flatly
  per ADR 0013.

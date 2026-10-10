# 0038 — Position bun-test-utils as a general-purpose test extension with Playwright-style fixtures

- **Status:** accepted
- **Date:** 2026-10-10

## Context

The published copy described the project as "pytest-style dependency injection for `bun test`". That framing appeared in the docs landing page, the site description, the root and package READMEs, the npm `description`, the CLI `--help` text, and the `FixtureDef` doc comment in the published `.d.ts`. It was never recorded as a decision. It lived in marketing copy.

The framing is wrong in two ways:

1. It defines the project by a runner it is not. Readers learn what the project lacks (a conftest-style scanner, implicit discovery) before they learn what it provides.
2. It hides the capabilities that make the project a complete test extension. BDD scenarios, property-based testing, snapshots, HTTP record/replay cassettes, DOM and browser testing, and the standard fixtures are all shipped, but the landing page presented the fixture engine alone.

The fixture model itself is closest to Playwright Test's. Fixtures are typed, injectable values. They are composed explicitly with `test.extend()`, they carry `session`, `file`, or `test` scopes, and their teardown runs in strict LIFO order even when the test fails ([Playwright fixtures](https://playwright.dev/docs/test-fixtures)). That is the model the docs should name.

## Decision

1. bun-test-utils describes itself as a **general-purpose test extension for the Bun test runner**, covering unit, integration, and end-to-end tests.
2. Its core model is **Playwright-style fixtures**: typed, injectable fixtures composed explicitly through `test.extend()`, with `session`/`file`/`test` scopes and guaranteed LIFO teardown.
3. **BDD scenarios, property-based testing, snapshot testing, HTTP record/replay cassettes, and DOM and browser testing are first-class capabilities**, documented alongside the fixture model. They are not add-ons to a fixture library.
4. Published copy (root README, npm and GitHub Packages README, docs site, package `description`, CLI help text, GitHub repository description, and doc comments in published declarations) states this model in positive terms. It does not define the project by the conventions of another runner.
5. The no-discovery property is kept as a fact about explicit composition: fixtures are available only through the imported `test.extend()` chain. It is stated as what composition is, not as a disclaimer about conftest-style files.
6. Records stay as they are. The superseded framing remains visible in ADR 0006, ADR 0008, ADR 0011, spec 0002, and milestone M2. This ADR supersedes **none** of them formally, because the pytest framing was never a recorded decision. Nothing is rewritten after the fact.

## Consequences

**Good**

- The first sentence a reader meets now names the category and the capabilities, not a missing feature.
- The fixture model is described in terms Playwright users already know, which lowers the cost of adopting the project.
- Published metadata (npm, GitHub, CLI) agrees with the docs site and the READMEs.

**Bad**

- Every user-facing page has to be rewritten, and future docs PRs must keep the positive framing. `apps/docs/README.md` carries that rule.
- Playwright-style is a comparison. Readers who do not know Playwright must still be able to learn the model from the docs alone.

## Alternatives considered

- **Keep the pytest framing.** Rejected. It defines the project by a runner it does not match, and it puts a missing feature first.
- **Position as "fixtures plus tooling" without naming the model.** Rejected. Naming the model, and the explicit `test.extend()` composition inside it, is what makes the fixture engine legible.
- **Rewrite the superseded ADRs.** Rejected. Decision records are immutable history, and the pytest references in them are accurate records of past reasoning.

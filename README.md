# bun-test-utils

<p align="center">
  <a href="https://github.com/Archont561/bun-test-utils/actions/workflows/ci.yml"><img src="https://github.com/Archont561/bun-test-utils/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Archont561/bun-test-utils/actions/workflows/docs.yml"><img src="https://github.com/Archont561/bun-test-utils/actions/workflows/docs.yml/badge.svg" alt="Docs"></a>
  <a href="https://www.npmjs.com/package/@archont561/bun-test-utils"><img src="https://img.shields.io/npm/v/%40archont561%2Fbun-test-utils?label=npm" alt="npm version"></a>
  <a href="https://archont561.github.io/bun-test-utils/"><img src="https://img.shields.io/badge/docs-Starlight-6d28d9" alt="Documentation"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-%E2%89%A51.1-black?logo=bun" alt="Bun >=1.1"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript" alt="TypeScript strict"></a>
  <a href="https://github.com/Archont561/bun-test-utils/blob/main/LICENSE-MIT"><img src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue" alt="MIT OR Apache-2.0"></a>
</p>

**A general-purpose test extension for the [Bun test runner](https://bun.sh/docs/test/overview).** It gives `bun test` Playwright-style fixtures: typed, injectable values that you compose explicitly with `test.extend()`, scoped to a session, a file, or a single test, and torn down in strict reverse order. On the same runner it adds behaviour-driven scenarios, property-based testing, snapshot testing, HTTP record/replay cassettes, and DOM and browser testing, for unit, integration, and end-to-end tests.

The published package is [`@archont561/bun-test-utils`](https://www.npmjs.com/package/@archont561/bun-test-utils). Its documentation is at <https://archont561.github.io/bun-test-utils/>.

## Quick start

```bash
bun add -d @archont561/bun-test-utils
bunx test-utils init
```

Compose your fixtures once, then import the extended `test` into each test file:

```ts
// tests/test.ts
import { test as base } from "@archont561/bun-test-utils";

export const test = base.extend({
  database: {
    scope: "file",
    setup: async (use) => {
      const database = await createDatabase();
      await use(database);
      await database.close(); // teardown runs after the file's last test
    },
  },
});
```

```ts
// tests/user.test.ts
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("the database is ready", async ({ database }) => {
  expect(await database.health()).toBe("ok");
});
```

Run `bun test`. The full guide is in the [quickstart](https://archont561.github.io/bun-test-utils/quickstart/).

## What it provides

| Capability | What you get | Guide |
| :-- | :-- | :-- |
| Fixtures | Typed fixtures composed with `test.extend()`, with `session`, `file`, and `test` scopes and LIFO teardown | [Scopes and teardown](https://archont561.github.io/bun-test-utils/guides/scopes-and-teardown/), [Explicit composition](https://archont561.github.io/bun-test-utils/guides/explicit-composition/) |
| Standard fixtures | `tmpdir`, `env`, `stdio`, `clock`, `seed`, `networkGuard` | [Built-in fixtures](https://archont561.github.io/bun-test-utils/reference/plugins/) |
| BDD scenarios | Fluent `given` / `when` / `then` tests on `test.scenario` (experimental) | [Scenarios and fluent API](https://archont561.github.io/bun-test-utils/guides/scenarios-and-fluent-api/) |
| Property-based testing | `test.prop` with fast-check, one fixture lifecycle per generated sample | [Property-based testing](https://archont561.github.io/bun-test-utils/guides/property-based-testing/) |
| Snapshot testing | The `snapshot` fixture for values and files | [Snapshot testing](https://archont561.github.io/bun-test-utils/guides/snapshot-testing/) |
| HTTP record/replay | The `cassette` fixture, `httpMock`, and deterministic replay of HTTP traffic | [Recording HTTP cassettes](https://archont561.github.io/bun-test-utils/guides/recording-http-cassettes/) |
| DOM and browser testing | happy-dom pages, Playwright pages, and one `webPage` fixture that selects either backend | [API reference](https://archont561.github.io/bun-test-utils/reference/api/) |

Install only the optional peers you use. `fast-check`, `@aboviq/bun-test-cucumber`, `happy-dom`, and `playwright` are each needed only by the capability that names them.

## Stability and platforms

- **Stable:** the fixture engine, and the standard, DOM, snapshot, and property-testing capabilities. These follow semantic versioning.
- **Experimental:** browser and BDD scenarios. They may change in minor versions.
- **Platforms:** Linux and macOS. Windows support is planned.

The full stability and compatibility contract is in the [API reference](https://archont561.github.io/bun-test-utils/reference/api/#stability-and-platforms).

## Repository layout

This repository is a Bun workspace. Only one package is published.

| Path | Role |
| :-- | :-- |
| `packages/bun-test-utils` | The published package. It bundles the workspaces below into `@archont561/bun-test-utils`. |
| `packages/core` | The fixture engine: scopes, dependency resolution, teardown, and the root `test` runner. |
| `packages/std` | Standard fixtures. |
| `packages/pbt` | Property-based testing helpers. |
| `packages/bdd` | Scenario helpers and the BDD integration. |
| `packages/dom`, `packages/browser`, `packages/server` | DOM, browser, and server fixtures. |
| `packages/snapshot`, `packages/vcr` | Snapshot and cassette fixtures. |
| `packages/cli` | The `test-utils` command. |
| `packages/config` | Shared TypeScript, build, and BDD configuration (private). |
| `apps/docs` | The documentation site, published to GitHub Pages. |

## Development

```bash
bun install
bun run build
bun run lint
bun run typecheck
bun run test       # unit and conformance suites
bun run test:bdd   # behavioural (Gherkin) suites
bun run test:e2e   # installed-package and consumer suites
bun run docs:dev   # documentation site, locally
```

Browser tests run headless only. `bun run install-browsers` installs the Playwright browsers the browser suites use. `scripts/restore.sh` provisions the pixi environment that supplies their system libraries on Linux.

## Contributing

Pull requests are welcome. Before you open one:

- Run `bun run lint && bun run typecheck && bun run test:all`.
- Update the package README and the documentation site when you change a public API.
- Add a changeset (`bun run changeset`) in the same pull request when the change affects what a user of the package sees.
- Record a design change as an ADR in `.backlog/docs/adr/` before you implement it.
- Write commit messages in Conventional Commits form.

The working agreements are in [`.backlog/docs/workflow.md`](.backlog/docs/workflow.md).

## License

Licensed under either the [MIT License](LICENSE-MIT) or the [Apache License 2.0](LICENSE-APACHE), at your option.

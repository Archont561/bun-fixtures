# bun-test-utils

<p align="center">
  <a href="https://github.com/Archont561/bun-test-utils/actions/workflows/ci.yml"><img src="https://github.com/Archont561/bun-test-utils/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Archont561/bun-test-utils/actions/workflows/docs.yml"><img src="https://github.com/Archont561/bun-test-utils/actions/workflows/docs.yml/badge.svg" alt="Docs"></a>
  <a href="https://img.shields.io/npm/v/bun-test-utils"><img src="https://img.shields.io/npm/v/bun-test-utils?label=npm" alt="npm version"></a>
  <a href="https://archont561.github.io/bun-test-utils/"><img src="https://img.shields.io/badge/docs-Starlight-6d28d9" alt="Documentation"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-%E2%89%A51.1-black?logo=bun" alt="Bun >=1.1"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript" alt="TypeScript strict"></a>
  <a href="https://github.com/Archont561/bun-test-utils/blob/main/LICENSE-MIT"><img src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue" alt="MIT OR Apache-2.0"></a>
</p>

Scoped, injectable fixtures for [`bun test`](https://bun.sh/docs/test/overview). Tests declare what they need; the engine resolves dependencies, manages lifetimes, and tears resources down in reverse order.

## Why this exists

Bun's native test runner is fast, but it does not provide a fixture model. `bun-test-utils` adds one without replacing `bun:test`: explicit composition, typed test contexts, `session`/`file`/`test` scopes, dependency injection, parameterization, property tests, snapshots, browser/DOM helpers, and BDD lifecycle hooks.

## Install

```bash
bun add -d bun-test-utils
bunx test-utils init
```

Optional capability dependencies:

```bash
bun add -d fast-check       # bun-test-utils/pbt
bun add -d happy-dom        # bun-test-utils/dom
bun add -d playwright       # bun-test-utils/browser
bun add -d @aboviq/bun-test-cucumber # bun-test-utils/bdd integrations
```

## Quick start

```ts
// tests/test.ts
import { test as base } from "bun-test-utils";

export const test = base.extend({
  user: {
    setup: async (use) => {
      await use({ id: 1, name: "Ada" });
    },
  },
});
```

```ts
// tests/user.test.ts
import { expect } from "bun-test-utils";
import { test } from "./test";

test("returns the fixture value", async ({ user }) => {
  expect(user.name).toBe("Ada");
});
```

For the complete API, see the [documentation](https://archont561.github.io/bun-test-utils/). Runnable examples live in the package READMEs:

- [Core fixture engine](packages/core/README.md)
- [Standard fixtures](packages/std/README.md)
- [Property-based testing](packages/pbt/README.md)
- [DOM fixtures](packages/dom/README.md)
- [Browser fixtures](packages/browser/README.md)
- [HTTP cassettes](packages/vcr/README.md)
- [Snapshots](packages/snapshot/README.md)
- [BDD bridge](packages/bdd/README.md)
- [Published wrapper and cross-cutting examples](packages/bun-test-utils/README.md)

## Status

The repository is in pre-release publication work. The engine and capability packs are implemented and covered by unit, conformance, Gherkin, and packed-consumer tests. npm publication of `bun-test-utils@0.1.0` is the remaining release milestone.

## Development

```bash
bun install
bun run lint
bun run typecheck
bun run build
bun test
bun run docs:dev
```

The monorepo uses Bun, Turborepo, Bunup, Biome, Changesets, and Astro Starlight. See the [development documentation](https://archont561.github.io/bun-test-utils/guides/getting-started/) before changing public APIs.

## Contributing

Pull requests are welcome. Add or update the relevant package README and documentation when changing a public API. Run `bun run lint && bun run typecheck && bun test` before opening a PR. Commit messages use Conventional Commits.

## License

Licensed under either the [MIT License](LICENSE-MIT) or the [Apache License 2.0](LICENSE-APACHE).

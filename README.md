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

Scoped, injectable fixtures for [`bun test`](https://bun.sh/docs/test/overview). Tests declare what they need; the engine resolves dependencies, manages lifetimes, and tears resources down in reverse order.

## Why this exists

Bun's native test runner is fast, but it does not provide a fixture model. `bun-test-utils` adds one without replacing `bun:test`: explicit composition, typed test contexts, `session`/`file`/`test` scopes, dependency injection, property tests, snapshots, browser/DOM helpers, and BDD lifecycle hooks.

## Install

```bash
bun add -d @archont561/bun-test-utils
bunx test-utils init
```

In an interactive terminal without `CI` set, `bunx test-utils init` asks for confirmation before writing `bunfig.toml` (`--yes` skips the prompt; `--dir <path>` and `--entry <path>` customize the target directory and preload path).

To reset recorded HTTP cassettes, callback sidecars, or snapshots, delete the test's cache with `bunx test-utils cache clear --file <test file> [--test <name>]` or `--all` (every cache file under the nearest `package.json` root). Add `--dry-run` to list the files first. In a TTY without `CI` set, the command shows the matched files as a multi-select and asks before deleting; `--yes` skips the prompts.

Optional capability dependencies are loaded by fixtures only when requested:

```bash
bun add -d fast-check # unlocks test.prop() / test.scenario.prop()
bun add -d @aboviq/bun-test-cucumber # unlocks test.scenario()
bun add -d happy-dom  # for DOM fixtures in the test context
bun add -d playwright # for browser fixtures in the test context
```

Use `defineArbitraries` from the helper-only `@archont561/bun-test-utils/pbt` subpath for
reusable fast-check arbitrary records. It contextually types the factory API
parameter and returns the definition unchanged:

```ts
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";

export const userArbitraries = defineArbitraries((fc) => ({
  name: fc.string(),
  age: fc.nat(),
}));
```

For reusable scenario callbacks, import `givenStep`, `whenStep`, and `thenStep`
from `@archont561/bun-test-utils/bdd`. Scenario execution itself remains on root `test.scenario(...)`.

For global snapshot serializers registered from a preload module, import
`createSnapshotSerializer`, `registerSnapshotSerializer`,
`unregisterSnapshotSerializer`, and `resetSnapshotSerializers` from
`@archont561/bun-test-utils/snap`. For reusable reversible cassette callback
serializers passed to `cassette.addSerializer(...)`, import
`defineCallbackSerializer` from `@archont561/bun-test-utils/vcr`.

## Quick start

```ts
// tests/test.ts
import { test as base } from "@archont561/bun-test-utils";

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
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("returns the fixture value", async ({ user }) => {
  expect(user.name).toBe("Ada");
});
```


## Fixture composition

There is no implicit fixture discovery. `fixtures.ts` and `conftest.ts` are not automatically loaded, and parent or sibling directories never contribute fixtures by location. Compose fixtures explicitly with `test.extend()` and import that extended test wherever the fixtures are needed.

The root runner contributes nineteen names to one flat fixture namespace: `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`, `window`, `document`, `page`, `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`, `cassette`, and `snapshot`. Composition is last-definition-wins: a consumer fixture intentionally overrides a built-in with the same key, and a later `extend()` overrides an earlier one.

## Stability and platform support

The fixture engine plus the standard, DOM, snapshot, property-testing, and minimal VCR capabilities are stable and follow semantic versioning. Browser and BDD are experimental: **experimental capabilities may change in minor versions**.

The stable VCR surface is `cassette.record(callback)`, `cassette.replay(callback)`, `cassette.addSerializer(...)` for reversible callback value serializers, and exact HTTP replay matching by uppercase method plus full URL. The default `VCR_MODE=auto` records a test's HTTP traffic and callback results under `__cassettes__/` on first use and replays them afterwards without network access (refusing to record missing cassettes when `CI` is set, and failing with `CASSETTE_MISMATCH` naming the `bunx test-utils cache clear` command when a request is missing from a present cassette). Matcher DSLs, configurable redaction, and cassette migration tooling are deferred.

Linux and macOS are supported. Windows support is planned after the first release; the current scratch-project harness and BDD presets still rely on POSIX paths.

## Status

The repository is in pre-release publication work. The engine and capability packs are implemented and covered by unit, conformance, Gherkin, and packed-consumer tests. npm publication of `@archont561/bun-test-utils@0.1.0` is the remaining release milestone.

## Roadmap — deliberately deferred

Parked as decisions rather than omissions, each with the condition that would start the work. Anything promoted off this list gets its own task with full acceptance criteria before any code is written.

**Not implemented — absent from `0.1.0` entirely:**

| Parked | Trigger that unparks it |
|--------|-------------------------|
| Database fixture (temporary `bun:sqlite`) | user demand — no speculative design before someone needs it |
| Public CLI / scratch-project runner fixture | user demand; would productize the internal `e2e/bdd/support/project.ts` harness |
| Filesystem sandbox beyond `tmpdir` | user demand not already met by the `tmpdir` fixture |
| Worker / concurrency-scoped fixtures | Bun's test parallelism semantics stabilize — `session` scope currently assumes a single process |
| Windows support | POSIX `URL.pathname` assumptions removed from the harness and BDD presets, **and** a Windows CI lane exists |
| VCR matcher DSL and cassette migration tooling | post-release demand establishes the right API; `0.1.x` freezes callback record/replay/addSerializer with exact method-plus-URL matching ([ADR 0018](./.backlog/docs/adr/0018-release-compatibility-contract.md), [ADR 0034](./.backlog/docs/adr/0034-cassette-callback-serializers.md)) |
| Explicit callback keys and global cassette serializer registration | a consumer needs to disambiguate factory closures across runs or register cassette serializers globally from a preload ([ADR 0027](./.backlog/docs/adr/0027-identify-callbacks-by-object-then-source.md), [ADR 0034](./.backlog/docs/adr/0034-cassette-callback-serializers.md), [ADR 0035](./.backlog/docs/adr/0035-persist-callback-results-across-runs.md)) |
| Mutation testing as an internal quality gate | the engine suite needs a stronger signal than line coverage |
| Fuzzing beyond fast-check | an invariant appears that property testing cannot express |
| Benchmark fixtures | a performance claim needs defending |
| Base-directory override for the `__cassettes__` / `__snapshots__` conventions | a consumer needs to redirect the convention and cannot via `cassette.save()`/`load()` or by choosing where the test file lives ([ADR 0019](./.backlog/docs/adr/0019-no-base-directory-override-in-0-1-x.md)) |
| A runtime settings surface (config file or `bunfig.toml` section) for project-wide defaults | a monorepo consumer needs two workspaces to run with different settings in a single `bun test` invocation — the one thing environment variables cannot express |

**Present in `0.1.0` but outside the stable contract** — usable, and free to change in a minor release:

| Ships, not yet stable | Trigger that stabilizes it |
|-----------------------|----------------------------|
| Header redaction (`cassette.redactHeader(name)`, plus a built-in sensitive-header default) | post-release demand settles the configuration shape; only `record`/`replay`/`addSerializer` are frozen for `0.1.x` |
| Browser capability (Playwright fixtures) | the Playwright peer and its CI path prove stable across releases |
| BDD capability (`test.scenario`) | `@aboviq/bun-test-cucumber` reaches 1.0, **or** the Gherkin integration is vendored |

The non-goals that are *not* coming back at all — implicit fixture discovery, public capability runner/fixture subpaths, shipping a runner — are in [caveats](./.backlog/docs/caveats.md).

## Development

```bash
bun install
bun run lint
bun run typecheck
bun run build
bun run test      # fast unit suites
bun run test:bdd  # behavioural (Gherkin) suites
bun run test:e2e  # full consumer-facing e2e (superset of bdd)
bun run test:all  # everything CI runs
bun run docs:dev
```

Browser tests run headless only ([ADR 0030](.backlog/docs/adr/0030-headless-only-browser-testing.md)). The pixi `browser` environment supplies the shared libraries Playwright's Chromium and Firefox binaries need on linux-64: `scripts/browser-activate.sh` puts them on the loader path under `pixi run`, and `packages/browser/tests/support/browser-libs.ts` does the same for a plain `bun test`. Missing Chromium binaries or libraries fail the fixture suite rather than silently skipping it. Firefox's Playwright-level proof may skip locally when unavailable, but is required under `CI=true`.

The monorepo uses Bun, Turborepo, Bunup, Biome, Changesets, and Astro Starlight. See the [development documentation](https://archont561.github.io/bun-test-utils/guides/getting-started/) before changing public APIs.

## Contributing

Pull requests are welcome. Add or update the relevant package README and documentation when changing a public API. Run `bun run lint && bun run typecheck && bun run test:all` before opening a PR. Commit messages use Conventional Commits.

### Browser testing

The `browser` fixture uses Playwright's Chromium; Firefox has a separate launch
proof, not a fixture. Install the repository's browser builds with:

```bash
bun run install-browsers
```

This runs `bunx playwright install chromium firefox` pinned to the workspace's
playwright version (1.63.0), downloading the revision-pinned builds into the
standard global cache (`~/.cache/ms-playwright` or `PLAYWRIGHT_BROWSERS_PATH`).
The system libraries (gtk3, xorg-libxi, xorg-libxrender for Chromium; libmozgtk
for Firefox) come from the pixi `browser` environment — run `sh scripts/restore.sh`
first to provision it.

CI calls the same command with system-library installation enabled:

```bash
bun run install-browsers --with-deps
```

The regular suite exercises the headless shell and the Firefox launch proof.
CI then reruns the real Chromium fixture suite in a fresh browser cache using
`bun run install-browsers --no-shell`, which proves the full-build fallback
without an old cached shell masking it ([ADR 0033](.backlog/docs/adr/0033-browser-ci-verification.md)).
See the [browser package examples](packages/browser/README.md) for real page
interaction and fixture lifetimes.

## License

Licensed under either the [MIT License](LICENSE-MIT) or the [Apache License 2.0](LICENSE-APACHE).

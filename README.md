# bun-test-utils

<p align="center">
  <a href="https://github.com/Archont561/bun-test-utils/actions/workflows/ci.yml"><img src="https://github.com/Archont561/bun-test-utils/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Archont561/bun-test-utils/actions/workflows/docs.yml"><img src="https://github.com/Archont561/bun-test-utils/actions/workflows/docs.yml/badge.svg" alt="Docs"></a>
  <a href="https://github.com/Archont561/bun-test-utils/releases"><img src="https://img.shields.io/github/v/release/Archont561/bun-test-utils?label=release" alt="Release"></a>
  <a href="https://archont561.github.io/bun-test-utils/"><img src="https://img.shields.io/badge/docs-starlight-6d28d9" alt="Documentation"></a>
  <a href="https://github.com/Archont561/bun-test-utils/blob/main/LICENSE-MIT"><img src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue" alt="MIT OR Apache-2.0"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-%E2%89%A51.1-black?logo=bun" alt="Bun >=1.1"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript" alt="TypeScript strict"></a>
  <a href="https://github.com/Archont561/bun-test-utils/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs welcome"></a>
</p>

<p align="center">
  <strong>pytest-style scoped, injectable fixtures for <code>bun test</code>.</strong><br>
  Declare what a test depends on; the engine builds it, injects it, and tears it down in order.
</p>

---

> [!IMPORTANT]
> **Nothing is published to npm yet.** The engine itself is real and tested: scopes,
> LIFO teardown, dependency injection, parameterization, directory-scoped discovery
> and the `init` CLI all work, covered by 215 passing tests across focused internal
> suites, cross-package conformance checks, Gherkin scratch projects, and an installed-tarball
> smoke test. What remains is the publication audit, a `v0.1.0` tag, the publish itself, and a
> post-publish consumer rerun — milestone [M5](.backlog/docs/milestones/M5-publish.md).
> Until then, use it from a checkout.

`bun test` has no fixture API ([oven-sh/bun#8257](https://github.com/oven-sh/bun/issues/8257)).
`bun-test-utils` adds one without touching `bun:test`: a test names its dependencies in its
parameter list, and a preload plugin resolves them from `fixtures.ts` files found by walking
the directory tree — the same idea as `conftest.py`.

```ts
import { test, expect } from "bun-test-utils";

test("creates a user", async ({ db }) => {
  expect(await db.insert({ name: "ada" })).toMatchObject({ id: 1 });
});
```

`db` was never imported, constructed, or reset here. The full model — scopes, `use()`
teardown, discovery and merge rules, parameterized fixtures, and fail-early registration
errors — lives in [`@bun-test-utils/core`](./packages/core#readme).

## 📦 Installation

> [!NOTE]
> Not on npm yet. The commands below are what installation *will* be; today, clone the
> repository and run `bun install`.

```bash
bun add -d bun-test-utils
bunx bun-test-utils init
```

`init` appends `./node_modules/bun-test-utils/dist/plugin.js` to `[test].preload` in
`bunfig.toml` — idempotently, preserving the rest of the file — and scaffolds a root
`fixtures.ts`. Every capability pack ships inside this one package as a subpath import; a
few subpaths wrap a heavy third-party library that installs as an `optionalDependency` —
add it yourself if your package manager skipped it:

```bash
bun add -d playwright             # only for bun-test-utils/browser
bun add -d happy-dom              # only for bun-test-utils/dom
bun add -d fast-check             # only for bun-test-utils/pbt
bun add -d @aboviq/bun-test-cucumber # only for bun-test-utils/bdd integrations
```

Importing a subpath without its optional dependency installed throws a clear error naming
the missing package and the install command — it never fails silently.

## ⚡ Quick start

Declare a fixture in any directory, then ask for it by name:

```ts
// tests/fixtures.ts
export default {
  tmpDir: {
    setup: async (use) => {
      const dir = `${process.env.TMPDIR ?? "/tmp"}/t-${crypto.randomUUID().slice(0, 8)}`;
      await Bun.$`mkdir -p ${dir}`.quiet();
      await use(dir);                     // everything after this is teardown
      await Bun.$`rm -rf ${dir}`.quiet();
    },
  },
};
```

```ts
// tests/writes.test.ts
import { test, expect } from "bun-test-utils";

test("writes into a scratch directory", async ({ tmpDir }) => {
  await Bun.write(`${tmpDir}/note.txt`, "hello");
  expect(await Bun.file(`${tmpDir}/note.txt`).text()).toBe("hello");
});
```

Errors from the engine and capability subpaths extend `BunTestUtilsError` and expose a
stable `code` plus optional structured `details`. Branch on the code rather than parsing
messages. Categories include `UNKNOWN_FIXTURE`, `SCOPE_MISMATCH`,
`CIRCULAR_DEPENDENCY`, `MISSING_OPTIONAL_DEPENDENCY`, and cassette failures.

The engine is silent by default. For integrations that need discovery or teardown
telemetry, install an optional structured diagnostics sink; no logging dependency is added
to the package:

```ts
import { configureDiagnostics } from "bun-test-utils";

const restore = configureDiagnostics((event) => logger.debug(event, event.message));
// Call restore() when the integration is unloaded.
```

`BUN_TEST_UTILS_DEBUG=1` enables an opt-in stderr fallback. CLI output is unaffected.

Parameterized fixtures expand into one `bun test` case per combination — the cartesian
product, including any parameterized fixture reached transitively — and mistakes surface
while tests are collected, not while they run:

```text
[bun-test-utils] unknown fixture "reel" requested in tests/api.test.ts. Available: db, server, user
[bun-test-utils] scope mismatch: "cache" (session) cannot depend on "tmp" (test)
[bun-test-utils] circular fixture dependency: a → b → a (tests/api.test.ts)
```

## 🧩 Capability subpaths

All capability packs are included in `bun-test-utils`; their workspace packages are
source-organization boundaries, not separate install targets. Details per pack in its
README:

| Subpath | Contents | Status |
| --- | --- | --- |
| [`bun-test-utils`](./packages/core#readme) (root) | Fixture engine — scopes, teardown, DI, params, CLI | ✅ Done |
| [`bun-test-utils/std`](./packages/std#readme) | `tmpdir`, `env`, `stdio` — zero-dependency isolation | 🚧 Not yet dogfooded by the core suite |
| [`bun-test-utils/pbt`](./packages/pbt#readme) | `test.prop` property-based testing (fast-check) | 🚧 No per-iteration fixture lifecycle |
| [`bun-test-utils/dom`](./packages/dom#readme) | `window`, `document`, `page` via happy-dom | ✅ Done |
| [`bun-test-utils/browser`](./packages/browser#readme) | `testServer`/`serverUrl`, Playwright `browser`/`context`/`page` | ✅ Done |
| [`bun-test-utils/vcr`](./packages/vcr#readme) | HTTP cassette record/replay | 🚧 No `__cassettes__/` convention |
| [`bun-test-utils/snapshot`](./packages/snapshot#readme) | Value and file snapshots, serializers, CI-strict mode | ✅ Done |
| [`bun-test-utils/bdd`](./packages/bdd#readme) | Gherkin hook bridge (`fixtureSteps`, `openFixtures`) | ✅ Done |

## 🧭 Repository map

Exactly one package publishes to npm; everything else is a private workspace bundled into
it as Bun-targeted ESM with declarations ([ADR 0014](.backlog/docs/adr/0014-bunup-built-publication.md)):

| Path | Package | Role |
| --- | --- | --- |
| [`packages/bun-test-utils/`](./packages/bun-test-utils) | `bun-test-utils` | Public wrapper: entrypoints, packaging, conformance + packaging E2E tests |
| [`packages/core/`](./packages/core#readme) | `@bun-test-utils/core` | Fixture engine, types, CLI internals |
| [`packages/{std,pbt,dom,browser,vcr,snapshot,bdd}/`](./packages/std#readme) | `@bun-test-utils/*` | Capability packs, flat subpath exports |
| [`packages/config/`](./packages/config#readme) | `@bun-test-utils/config` | Shared tsconfigs and the Bunup build factory |
| `apps/docs/` | — | Astro Starlight docs site → [archont561.github.io/bun-test-utils](https://archont561.github.io/bun-test-utils/) |
| `.backlog/` | — | Project state; specs, milestones and ADRs under `.backlog/docs/` |

`packages/bun-test-utils/tests/` holds in-process conformance suites; `e2e/` sits beside it
because those tests exercise the assembled, packed product. There is deliberately no
repository-root `fixtures.ts` ([ADR 0008](.backlog/docs/adr/0008-no-root-fixtures-file.md)).

## 🗺️ Status

| Milestone | Outcome | Status |
| ---: | --- | --- |
| M1 | Fixture engine — scopes, teardown, DI, parameterization | ✅ Done |
| M2 | Preload discovery and path-based merge | ✅ Done |
| M3 | CLI `init` — `bunfig.toml` edit and scaffold | ✅ Done |
| M4 | Types, docs and dogfooding tests | ✅ Done |
| M5 | Publish to npm | 🚧 In progress |

Task state is authoritative in Backlog — `bunx backlog status`. Plans live in
[`.backlog/docs/milestones/`](.backlog/docs/milestones), rationale in
[`.backlog/docs/adr/`](.backlog/docs/adr).

## 🛠️ Development

[Bun](https://bun.sh) runs the toolchain, [Bunup](https://bunup.dev) builds each code
package, and [Turborepo](https://turbo.build) fans tasks out across the workspace.

```bash
bun install        # link workspace packages and install Git hooks
bun run lint       # Biome
bun run typecheck  # tsc --noEmit in every package
bun run build      # Bunup builds into dist/
bun test           # unit, conformance, behavioural and packaging suites
bun run docs:dev   # Astro Starlight docs site
```

Lefthook runs Biome and `typecheck` on commit, commitlint on the message, and the full test
suite on push. A [Dev Container](.devcontainer/devcontainer.json) is checked in with Bun
pinned and both dev servers forwarded.

## 🚢 Releases

Releases are driven by [Changesets](https://changesets.dev) — `bun-test-utils` is the only
package that versions or publishes; commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/).

> [!WARNING]
> The package is still at an unpublished `0.1.0`. Changesets bumps *from* the current
> version, so a changeset landed now would make the first release `0.1.1` and skip `0.1.0`.
> Cut `0.1.0` first — see [`.changeset/README.md`](.changeset/README.md).

## 🤝 Contributing

Issues and pull requests are welcome. Run the same gates CI runs before opening a PR:
`bun run lint && bun run typecheck && bun test`. A public API change needs the README
**and** the matching spec in [`.backlog/docs/specs/`](.backlog/docs/specs); a design change
needs a new ADR. The working loop is described in
[`.backlog/docs/workflow.md`](.backlog/docs/workflow.md).

## 📄 License

Licensed under either of the following, at your option:

- [Apache License, Version 2.0](LICENSE-APACHE)
- [MIT License](LICENSE-MIT)

Unless you state otherwise, any contribution you intentionally submit for inclusion in this
work shall be dual-licensed as above, with no additional terms or conditions.

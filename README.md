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
> and the `init` CLI all work, covered by 168 passing tests across a unit suite, a
> Gherkin behavioural suite that drives real scratch projects, and per-plugin suites.
> What is missing is the release: `CHANGELOG`, a `v0.1.0` tag, a pack smoke test and
> the publish itself — milestone [M5](.backlog/docs/milestones/M5-publish.md).
> Four of the five plugin packages also have a known gap, listed in the Roadmap
> below. Until then, use it from a checkout.

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

`db` was never imported, constructed, or reset here.

## 🧠 Philosophy and model

### Setup is a dependency, not a prologue

A test should name what it needs and receive it. `beforeEach` chains describe *when* things
happen; fixtures describe *what a test depends on* and let the runner work out the order.

The design commitments behind that:

- **Teardown is the second half of setup.** One function owns both halves, split by the
  moment it hands the value over. Cleanup written far from the allocation rots.
- **Scope is a contract.** `session`, `file` and `test` say how long a value lives and
  therefore who may share it. A long-lived fixture may not depend on a short-lived one —
  it would outlive its own dependency.
- **The directory tree is the configuration.** Fixtures belong to the tests beneath them,
  and a nearer declaration wins. Moving a test to another folder changes what it can ask for.
- **Failures belong at registration.** Unknown names, dependency cycles and scope violations
  surface during collection, with the available fixtures listed — not as a mystery failure
  on test 47.
- **No magic, no globals.** `bun:test` is left untouched and `test` is an explicit import,
  opt-in per file. A file that does not import it behaves exactly as before.
- **A thin wrapper, deliberately.** If Bun ships a fixture API, this engine should become a
  compatibility shim and get out of the way.

### The model

A fixture is one object. `await use(value)` suspends until the scope ends, so everything
after it is teardown:

```ts
interface FixtureDef<T = any> {
  setup: (use: (value: T) => Promise<void>, ctx: FixtureContext) => void | Promise<void>;
  scope?: "session" | "file" | "test";  // default: "test"
  params?: T[];                         // multiplies the tests that use it
  deps?: string[];                      // explicit, when destructuring won't do
}
```

A representative `fixtures.ts` looks like this:

```ts
export default {
  server: {
    scope: "session",
    setup: async (use) => {
      const s = await startServer();
      await use(s);        // the tests run here
      await s.stop();      // …and this is guaranteed to follow
    },
  },

  db: {
    scope: "file",
    setup: async (use, { server }) => {   // ← dependency, by name
      const db = await server.connect();
      await use(db);
      await db.close();
    },
  },

  user: {
    setup: async (use, { db }) => {       // ← test scope (the default)
      await use(await db.insert({ name: "ada" }));
    },
  },
} satisfies FixtureMap;
```

| Scope | Built | Destroyed |
| --- | --- | --- |
| `"session"` | once per `bun test` run | after the run |
| `"file"` | once per test file | when the file is done |
| `"test"` | every test (**default**) | immediately after the test |

Teardown is **LIFO** — dependents before their dependencies.

### User-facing API

| Surface | API today | Role |
| --- | --- | --- |
| Test | `test(name, fn, opts?)` | Fixture-aware test; finds its own file from the stack. `opts`: `{ fixtures?, timeout?, iterate? }` |
| Test | `createTest(file?)` | `{ test, describe, expect }` bound to an explicit file — pass `import.meta.path` |
| Test | `expect`, `describe` | Re-exported from `bun:test`, unchanged |
| Iteration | `opts.iterate` → `ctx.iterate(fn)` | Defer test-scoped fixtures: each `ctx.iterate` call builds them fresh and unwinds them LIFO — the per-sample lifecycle property runners use (see [`@bun-test-utils/pbt`](./packages/bun-test-utils/pbt)) |
| CLI | `bunx bun-test-utils init [--dir] [--entry] [--force]` | Append the preload to `bunfig.toml` and scaffold a root `fixtures.ts` |
| Types | `FixtureDef`, `FixtureMap`, `FixtureContext`, `Scope`, `TestOptions`, `IterateFn` | The public type surface |
| Engine | `discoverFixtures`, `fixturesFor`, `resolveOrder`, `paramCombos`, `detectFixtures`, `callerFile`, `teardownFile`, `teardownSession` | Internals exported for tooling and for testing fixture trees |

Two environment variables override discovery: `BUN_TEST_UTILS_ROOT` sets the tree root, and
`BUN_TEST_UTILS_NO_AUTODISCOVER` disables the startup walk entirely.

## 🧭 Architecture

```text
                        bun test  +  [test].preload
                                   │
                                   ▼
                 discovery — walk the directory tree once
                 fixtures.ts / conftest.ts, merged root → leaf
                                   │
                                   ▼
                 resolution — dependencies, scopes, params
                                   │
          ┌─────────────┬──────────┴──────────┬─────────────┐
          ▼             ▼                     ▼             ▼
       session         file                  test      parameterized
      (per run)     (per file)            (per test)  (cartesian product)
          └─────────────┴──────────┬──────────┴─────────────┘
                                   ▼
                      injected into the test function
                                   │
                                   ▼
                        LIFO teardown, per scope
```

| Layer | Package | Role |
| --- | --- | --- |
| Engine | [`bun-test-utils`](./packages/bun-test-utils) | Discovery, scope cache, DI, parameterization, `init` CLI |
| Fixtures | [`@bun-test-utils/std`](./packages/bun-test-utils/std) | Zero-dependency `tmpdir`, `env`, `stdio` with automatic restoration |
| Fixtures | [`@bun-test-utils/pbt`](./packages/bun-test-utils/pbt) | `test.prop` — property-based testing over injected fixtures |
| Fixtures | [`@bun-test-utils/dom`](./packages/bun-test-utils/dom) | `window`, `document`, `page` via happy-dom, globals restored on teardown |
| Fixtures | [`@bun-test-utils/browser`](./packages/bun-test-utils/browser) | Ephemeral `Bun.serve` test server and Playwright `browser`/`context`/`page` |
| Fixtures | [`@bun-test-utils/vcr`](./packages/bun-test-utils/vcr) | Cassette fixture that records and replays `fetch` deterministically |
| Fixtures | [`@bun-test-utils/snapshot`](./packages/bun-test-utils/snapshot) | Value and file snapshot fixture with pluggable serializers and CI-strict mode |
| Internal | [`@bun-test-utils/config`](./packages/config) | Shared `base`/`lib`/`app` TypeScript configurations (private) |

Every "Fixtures" row above is an internal, unpublished (`private: true`) workspace package —
none of them ship to npm on their own. They're bundled into the single published
`bun-test-utils` package and reached as subpath imports (`bun-test-utils/std`,
`bun-test-utils/vcr`, ...), each contributing a plain `FixtureMap` object — there is no
plugin registry or lifecycle to learn.

## 📦 Installation

> [!NOTE]
> Not on npm yet. The commands below are what installation *will* be; today, clone the
> repository and run `bun install`.

```bash
bun add -d bun-test-utils
bunx bun-test-utils init
```

`init` appends `./node_modules/bun-test-utils/src/plugin.ts` to `[test].preload` in
`bunfig.toml` — idempotently, preserving the rest of the file — and scaffolds a root
`fixtures.ts`. Every fixture pack ships inside this one package as a subpath import —
no extra installs for the pack itself, import the one you want:

```ts
import { tmpdirFixture } from "bun-test-utils/std";
import { prop } from "bun-test-utils/pbt";
import { windowFixture } from "bun-test-utils/dom";
import { browserFixture } from "bun-test-utils/browser";
import { cassetteFixture } from "bun-test-utils/vcr";
import { snapshotFixture } from "bun-test-utils/snapshot";
```

A few subpaths wrap a heavy third-party library that only installs as an
`optionalDependency` — add it yourself if `bun install` skipped it on your platform:

```bash
bun add -d playwright   # only for bun-test-utils/browser
bun add -d happy-dom    # only for bun-test-utils/dom
bun add -d fast-check   # only for bun-test-utils/pbt
```

Importing a subpath without its optional dependency installed throws a clear error naming
the missing package and the install command — it never fails silently.

The package ships raw TypeScript with no build step; Bun executes `.ts` directly.

## ⚡ Quick start

Declare a fixture in any directory, then ask for it by name:

```ts
// tests/fixtures.ts
export default {
  tmpDir: {
    setup: async (use) => {
      const dir = `${process.env.TMPDIR ?? "/tmp"}/t-${crypto.randomUUID().slice(0, 8)}`;
      await Bun.$`mkdir -p ${dir}`.quiet();
      await use(dir);
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

Parameterized fixtures expand into one `bun test` case per combination — the cartesian
product, including any parameterized fixture reached transitively:

```ts
mode:   { params: ["fast", "slow"], setup: async (use, { param }) => use(param) },
region: { params: ["eu", "us"],     setup: async (use, { param }) => use(param) },
```

```text
✓ round trips [mode=fast, region=eu]
✓ round trips [mode=fast, region=us]
✓ round trips [mode=slow, region=eu]
✓ round trips [mode=slow, region=us]
```

Mistakes are reported while tests are collected, not while they run:

```text
[bun-test-utils] unknown fixture "reel" requested in tests/api.test.ts. Available: db, server, user
[bun-test-utils] scope mismatch: "cache" (session) cannot depend on "tmp" (test) — a fixture
              may only use equally or longer-lived fixtures.
[bun-test-utils] circular fixture dependency: a → b → a (tests/api.test.ts)
```

## ✨ Design goals

| Goal | What it means |
| --- | --- |
| **Declarative** | A test names its dependencies; the engine resolves order, caching and cleanup |
| **Directory-scoped** | Discovery follows the filesystem — nearest `fixtures.ts` wins, siblings stay invisible |
| **Scope-safe** | Lifetime violations are registration errors, not flaky tests |
| **Fail-early** | Unknown names, cycles and scope mismatches surface during collection |
| **Non-invasive** | `bun:test` is untouched; opt in per file with an explicit import |
| **No build step** | Raw TypeScript ships to npm; Bun runs it directly |
| **Modular** | Fixture packs are ordinary subpath imports contributing plain objects — one install, pick what you use |
| **Self-tested** | The engine is exercised through its own fixtures, plus a behavioural suite that runs real scratch projects |

## 🛠️ Development

[Bun](https://bun.sh) is the only toolchain — no compiler, no bundler.
[Turborepo](https://turbo.build) fans tasks out across the workspace.

```bash
bun install        # link workspace packages and install Git hooks
bun test           # unit, behavioural and plugin suites
bun run typecheck  # tsc --noEmit in every package
bun run lint       # Biome
```

> [!TIP]
> A [Dev Container](.devcontainer/devcontainer.json) is checked in — **Reopen in Container**
> in VS Code, or `devcontainer up --workspace-folder .`, and it installs Bun at the version
> `packageManager` pins, runs `bun install --frozen-lockfile`, and forwards the docs site
> (`4321`) and the Backlog board (`7878`).

| Task | Purpose |
| --- | --- |
| `test` / `test:unit` / `test:bdd` | All suites · dogfooding suite only · Gherkin suite only |
| `typecheck` | `tsc --noEmit` across every workspace package |
| `lint` / `lint:fix` / `format` | Biome check, autofix, and format |
| `docs:dev` / `docs:build` / `docs:preview` | Serve, build or preview the Astro + Starlight site |
| `changeset` | Describe a change for the next release |
| `release:version` / `release:publish` | Consume changesets · publish to npm |
| `status` / `board` | Backlog project summary · kanban board |

| Suite | Where | What it proves |
| --- | --- | --- |
| unit / dogfooding | `packages/bun-test-utils/tests/` | Engine internals, in-process, using its own fixtures |
| behavioural (Gherkin) | `packages/bun-test-utils/features/` + `tests/steps/` | User-visible behaviour in real scratch projects, driven only through files, `bun test` output and exit codes |
| plugin | `packages/bun-test-utils/*/tests/` | Each internal fixture pack's own capabilities |

Lefthook runs Biome and `typecheck` on commit, commitlint on the message, and the full test
suite on push — so CI and a local commit can only disagree if the lockfile did.

## 🗂️ Repository map

| Path | Purpose |
| --- | --- |
| `packages/bun-test-utils/` | Core engine, `init` CLI, public API, and the single publishable npm package |
| `packages/bun-test-utils/{std,pbt,dom,browser,vcr,snapshot}/` | Internal, unpublished (`private: true`) workspace packages — bundled into `bun-test-utils` as flat subpath exports (`bun-test-utils/std`, `bun-test-utils/pbt`, ...), never published on their own |
| `packages/config/` | Shared `base`/`lib`/`app` tsconfigs (private) |
| `apps/docs/` | Astro + Starlight documentation site |
| `.backlog/` | Backlog project state — tasks, claims, runs |
| `.backlog/docs/` | Specs, milestones, ADRs, workflow and caveats |
| `.changeset/` | Pending unreleased changes |
| `.agents/skills/` | Agent skills (`session`, `tdd`, `refactor`, `grill-me`, `skill-creator`) |
| `.devcontainer/` | Dev Container — Node base image, Bun pinned from `packageManager` |
| `bunfig.toml` | `[test].preload` for running `bun test` from the root |
| `turbo.json` · `biome.json` · `lefthook.yml` | Pipeline, lint/format and Git hooks |

The root `package.json` is `private: true`; `packages/bun-test-utils/` is the only package that
ever publishes to npm — everything under `packages/bun-test-utils/{std,pbt,dom,browser,vcr,snapshot}/`
is an internal workspace package bundled into it. The `@` alias resolves to the `bun-test-utils`
package root from either cwd — `@` maps to `src/plugin.ts` and `@/*` to the package root.

> [!TIP]
> There is deliberately **no package-root `fixtures.ts`** ([ADR 0008](.backlog/docs/adr/0008-no-root-fixtures-file.md)).
> Root-level discovery is covered instead by the end-to-end test and the behavioural suite,
> which both scaffold throwaway projects in `tmpdir`.

## 🚢 Releases

Releases are driven by [Changesets](https://changesets.dev). `bun-test-utils` is the only
package that ever versions or publishes — everything under its internal `{std,pbt,dom,
browser,vcr,snapshot}/` workspace packages is `private: true` and moves in lockstep as part
of the same tarball.

```bash
bun run changeset        # describe the change; commit the generated file
bun run release:version  # consume changesets: bump the version, write the CHANGELOG
bun run release:publish  # publish and tag
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) and are
enforced by commitlint through Lefthook.

> [!WARNING]
> The package is still at an unpublished `0.1.0`. Changesets bumps *from* the current
> version, so a changeset landed now would make the first release `0.1.1` and skip `0.1.0`.
> Cut `0.1.0` first — see [`.changeset/README.md`](.changeset/README.md).

## 🗺️ Roadmap

| Milestone | Outcome | Status |
| ---: | --- | --- |
| M1 | Fixture engine — scopes, teardown, DI, parameterization | ✅ Done |
| M2 | Preload discovery and path-based merge | ✅ Done |
| M3 | CLI `init` — `bunfig.toml` edit and scaffold | ✅ Done |
| M4 | Types, docs and dogfooding tests | ✅ Done |
| M5 | Publish to npm | 🚧 In progress |

| Ecosystem subpath | Outcome | Status |
| --- | --- | --- |
| `@bun-test-utils/config` (internal, build-time only) | Shared monorepo TypeScript configurations | ✅ Done |
| `apps/docs` | Astro Starlight site on GitHub Pages | ✅ Done |
| `bun-test-utils/std` | `tmpdir`, `env`, `stdio` | 🚧 Not yet dogfooded by the core suite |
| `bun-test-utils/pbt` | `test.prop` property-based testing | 🚧 No per-iteration fixture lifecycle |
| `bun-test-utils/dom` · `browser` | happy-dom and Playwright fixtures | 🚧 Playwright path untested |
| `bun-test-utils/vcr` | HTTP record and replay | 🚧 No `__cassettes__/` convention |
| `bun-test-utils/snapshot` | Value and file snapshot testing | ✅ Done |

Task state is authoritative in Backlog — `bunx backlog status`. Every 🚧 task records its
precise remaining gap in its description (`bunx backlog task show <id>`). The narrative plan
lives in [`.backlog/docs/milestones/`](.backlog/docs/milestones) and the rationale in
[`.backlog/docs/adr/`](.backlog/docs/adr).

## 🤝 Contributing

Issues and pull requests are welcome. Run the same gates CI runs before opening a PR:

```bash
bun run lint && bun run typecheck && bun test
```

The working loop is claim → red → green → refactor → verify, described in
[`.backlog/docs/workflow.md`](.backlog/docs/workflow.md). A public API change needs the
README **and** the matching spec in [`.backlog/docs/specs/`](.backlog/docs/specs); a design
change needs a new ADR. Keep changes focused and put tests beside the source they cover.

## 📄 License

Licensed under either of the following, at your option:

- [Apache License, Version 2.0](LICENSE-APACHE)
- [MIT License](LICENSE-MIT)

Unless you state otherwise, any contribution you intentionally submit for inclusion in this
work shall be dual-licensed as above, with no additional terms or conditions.

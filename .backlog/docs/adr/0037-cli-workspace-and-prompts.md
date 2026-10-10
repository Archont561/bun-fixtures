# 0037 — CLI as a private workspace bundled into the metapackage, with citty commands and clack prompts

- **Status:** proposed
- **Date:** 2026-10-10

## Context

The `test-utils` binary is the only CLI surface a consumer sees. It is declared in
`packages/bun-test-utils/package.json` (`bin.test-utils` → `./dist/cli.js`). Its code lives in
`@bun-test-utils/core/cli` (`packages/core/src/cli.ts`, `packages/core/src/cache.ts`), and the
metapackage's `src/cli.ts` re-exports it.

Three facts shape the decision:

1. **Core is the fixture engine, not the CLI.** `@bun-test-utils/core` is private, and it now
   carries `init`, `cache clear`, citty, and `smol-toml`. Those belong to a command surface.
2. **The metapackage's `exports` map has no `./cli` entry.** The library names exported from
   `cli` are reachable only through the bundle, so the binary and its flags are the stable CLI
   contract. `scripts/public-api.txt` still lists those names so that changes stay visible.
3. **The packaging pattern is already settled.** ADR 0013 makes internal workspaces private and
   bundles them into the one published package. ADR 0031 adds a bundled workspace by adding one
   entry to `bundledWorkspaces` in `packages/bun-test-utils/bunup.config.ts`. Spec 0005 R10 says
   only the metapackage is published.

The design questions were settled in discussion. There is no config file in v1. Clack prompts
serve `cache clear` only. The project root is the nearest `package.json`.

## Decision

**1. A new private workspace, `@bun-test-utils/cli`.** It lives at `packages/cli` and is
`"private": true`, like the other internal packages. It owns the citty command tree, the clack
prompts, project-root resolution, and the cache planner. `init` and `cache clear` move out of
`@bun-test-utils/core`. Core keeps `slugifyFilename` and the fixtures. `citty` and `smol-toml`
move with the commands.

**2. Bundled into the metapackage, which is still the only published package.**

- `packages/bun-test-utils/bunup.config.ts`: in `bundledWorkspaces`, replace
  `@bun-test-utils/core/cli` with `@bun-test-utils/cli`. The `src/cli.ts` entry stays the same.
- `bin.test-utils` stays `./dist/cli.js`. No new binary is added.
- `citty` and `@clack/prompts` are declared as runtime `dependencies` of the metapackage. Third-party
  packages are externalized, which is the existing `citty` precedent. `@clack/prompts` is pinned to
  the version in the lockfile (1.8.1). It is already present there as a transitive dependency of
  changesets.

**3. Commands.**

- `test-utils init [--dir <path>] [--entry <path>] [--force]`: flags unchanged. In a TTY, without
  `--yes`, it asks for confirmation before it writes `bunfig.toml`. It never prompts in CI or in a
  non-TTY.
- `test-utils cache clear` with exactly one scope, as in ADR 0036: `--file <path>`,
  `--file <path> --test <name>`, or `--all`. A missing scope is a usage error in every mode. Added
  here: `--yes`.
  - In a TTY, with a scope, `cache clear` shows the matched files as a multi-select, all selected
    by default. The user deselects, then confirms. `--yes` skips both steps.
  - `--dry-run` never prompts and never deletes.
  - Outside a TTY, or with `CI` set, it never prompts. It deletes the matched files directly, as
    ADR 0036 already specifies. The explicit scope is the confirmation.

**4. Project root.** With `--all`, the root is the nearest `package.json` at or above the working
directory. A file scope (`--file`) stays relative to the working directory. The output always names
the root it scanned. If no `package.json` exists above the working directory, the command exits with
a usage error that tells the user to run it from the project root. A run that matches nothing prints
how many files it scanned, so a quiet no-op from a subdirectory is visible.

**5. No config file in v1.** There is no `test-utils.config.ts`, no `defineConfig`, and no
`@archont561/bun-test-utils/config` subpath. A later ADR must add config. Its first setting must be
something a flag cannot express.

**6. Public contract.** The `test-utils` binary and its flags are the stable CLI surface. The
library names exported from the bundled `cli` entry stay listed in `scripts/public-api.txt` for
visibility. They are not semver-covered and are not part of the documented API.

## Consequences

**Good**

- Core is back to being the fixture engine. The CLI has its own tests and dependencies.
- The published surface does not change in shape. There is still one package, one bin, and no
  extra entrypoint.
- Prompts make the destructive path interactive where a person is present. Scripts and CI keep
  flag-only behaviour.

**Bad**

- Moving commands out of core changes import paths. The only consumers are the metapackage wrapper
  and the tests, which move with the code.
- Outside a TTY, `cache clear` deletes with no confirmation. Scripts must use an explicit scope, and
  `--dry-run` is the safe check. This is intentional, but it is a footgun.
- Behaviour now depends on whether stdin and stdout are TTYs. Tests have to cover both branches,
  through an injected prompter.
- Project-root detection is a new rule. A monorepo with a `package.json` in each package makes
  `--all` scope to that package only, which is the intended effect.

## Alternatives considered

- **Keep the commands in `@bun-test-utils/core/cli`.** Rejected. It keeps CLI dependencies in the
  fixture engine.
- **Publish a separate `@archont561/test-utils-cli` package.** Rejected. It adds a publish surface
  that ADR 0013 and spec 0005 R10 were written to avoid.
- **Add `test-utils.config.ts` now.** Deferred. There is no setting that needs it yet, and a config
  file with one flag-equivalent setting duplicates the flags.
- **Prompt for `init` values.** Rejected. Prompting for an entry path or a bunfig edit adds friction
  without value. Only the confirmation is kept.
- **Keep cwd as the `--all` root.** Rejected. From a subdirectory it reports a quiet no-op.

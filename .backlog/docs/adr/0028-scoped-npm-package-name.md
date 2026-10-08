# 0028 — Publish the wrapper as `@archont561/bun-test-utils`

- **Status:** accepted
- **Date:** 2026-10-09
- **Amends:** [0013](./0013-published-wrapper-internal-workspaces.md) (the published package name)

## Context

The public wrapper in `packages/bun-test-utils` is the only publishable package. Its unscoped name, `bun-test-utils`, is free on npm as of 2026-10-09 (the registry answers 404). No version has been published under either name, so no consumer depends on either one.

The owner scope `@archont561` already holds a placeholder package, `@archont561/bun-test-utils` (created 2026-10-08; versions `0.0.0-stage` and `0.0.0`; README "DO NOT USE THIS PACKAGE"). npm trusted publishing is configured per package, so the publisher belongs to the exact name that gets published. GitHub's npm registry accepts only scoped names (`@OWNER/name`), so a GitHub Packages publication would need the scope anyway.

## Decision

The public package is `@archont561/bun-test-utils`. The following use the scoped name, because they are the npm identity:

- the manifest `name` and the packed tarball (`archont561-bun-test-utils-<version>.tgz`);
- the root and subpath import specifiers (`@archont561/bun-test-utils`, `/bdd`, `/pbt`, `/snap`) and install commands;
- the npm badge and the preload path that `test-utils init` writes (`./node_modules/@archont561/bun-test-utils/dist/plugin.js`);
- the workspace wiring that refers to the public package (root devDependency, tsconfig path mappings, turbo `pkg#task` keys).

These keep their current names, because they are not the npm identity:

- the private `@bun-test-utils/*` workspace scope (ADR 0013); those packages are never published;
- the root package `bun-test-utils-monorepo`;
- the `test-utils` binary;
- the repository URL, the docs base path `/bun-test-utils/`, and the `packages/bun-test-utils` directory;
- product prose, and the `[bun-test-utils…]` diagnostic prefixes that ADR 0018 treats as contractual error messages;
- the `Symbol.for("bun-test-utils.…")` keys, which coordinate the global singleton between copies of the engine. Changing them is a separate compatibility decision.

Historical records (ADR bodies, closed milestones, done tasks, and the archived claims) keep the names they were written with.

## Consequences

**Good:** the published name matches the owner scope, the existing placeholder, and the trusted-publisher configuration. The same name works for a GitHub Packages publication. The unscoped name is not claimed and not aliased.

**Bad:** every install and import line changes. Older text that names the unscoped package will point at nothing on npm. `release.yml` uploads `${{ runner.temp }}/bun-test-utils-*.tgz` with `fail_on_unmatched_files: true`; that glob no longer matches the renamed tarball and has to change before the `v0.1.0` tag. That change belongs to task_066 and is not made by this decision.

## Alternatives considered

- **Keep the unscoped `bun-test-utils`.** The name is free, but it leaves the placeholder unused and still needs a scoped name for GitHub Packages.
- **Publish under both names.** Two identities to publish, verify, and document, with no consumer benefit before 0.1.0.
- **Rename the private scope too.** Not needed: the private packages are never published, so their names do not reach consumers.

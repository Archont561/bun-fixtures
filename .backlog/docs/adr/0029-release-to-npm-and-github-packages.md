# 0029 — Release from a tag on main to npm and GitHub Packages

- **Status:** accepted
- **Date:** 2026-10-09
- **Builds on:** [0014](./0014-bunup-built-publication.md) (what is published), [0018](./0018-release-compatibility-contract.md) (the release contract), [0028](./0028-scoped-npm-package-name.md) (the name)

## Context

The public package is `@archont561/bun-test-utils` (ADR 0028). Its release workflow published only to npm, through npm Trusted Publishing: no npm token, and a short-lived OIDC credential exchanged at publish time. The GitHub Release step attached the packed tarball with a glob that still named the unscoped package, so it would fail after the npm publish has already succeeded.

`auto-release.yml` cuts version tags from `main` and pushes its version bump to `main`. The first release is cut from a tag on `main` instead.

GitHub's npm registry (`npm.pkg.github.com`) accepts only scoped names owned by the repository owner. A workflow authenticates with `GITHUB_TOKEN` when the job has `packages: write`.

## Decision

1. A release is a `v<version>` tag on a commit already on `main`. The verify job refuses a tag that is not on `main`, and refuses a tag whose version differs from `packages/bun-test-utils/package.json`.
2. After verification, two jobs publish the same version. Neither depends on the other.
   - `publish-npm` runs in the environment `npm`, which has no protection rules: the maintainer's tag push is the approval. It publishes with `npm publish --provenance --access public` under Trusted Publishing. The npmjs.com trusted publisher names this repository, this workflow, and this environment, and allows direct `npm publish`.
   - `publish-github-packages` publishes to `https://npm.pkg.github.com` under the `@archont561` scope, authenticated with `GITHUB_TOKEN`. It has no environment and does not request provenance.
3. `publish-npm` uploads the packed tarball as the workflow artifact `release-tarball`.
4. `github-release` runs only after both registry jobs succeed. It downloads that artifact and attaches the tarball to the GitHub Release.

No npm token is stored in the repository or in secrets. `NODE_AUTH_TOKEN` is set only in the GitHub Packages job, to `GITHUB_TOKEN`.

## Consequences

**Good:** either registry job can be re-run on its own. The GitHub Release appears only after both registries have accepted the version. The tarball can be downloaded from the run page.

**Bad:**
- If one registry fails after the other succeeded, the two registries hold different sets of versions. Registries do not accept a version twice, so the fix ships as the next patch version.
- A new GitHub Packages package starts private. Consumers installing from GitHub Packages need a token even for public packages, so visibility is a separate decision.
- Each publish job rebuilds from the same commit. The tarballs match in content but are not guaranteed to match in bytes.
- A new npm trusted-publisher entry must complete its first publish within two days of creation, or it expires and must be recreated.

## Alternatives considered

- **Publish to GitHub Packages from `auto-release.yml`.** Rejected: that workflow commits to `main` and cuts releases from `main` as it stands.
- **One job that publishes to both registries in sequence.** Rejected: a GitHub Packages failure would block npm, and a re-run after a partial success would fail on the version that already exists.
- **An npm token secret.** Rejected: the workflow is built on Trusted Publishing and holds no token.
- **Gating the `npm` environment with a required reviewer.** Deferred, not rejected: the environment can gain reviewers later without changing the workflow, but the trusted publisher must keep naming the same environment.

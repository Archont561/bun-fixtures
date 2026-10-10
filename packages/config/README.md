# @bun-test-utils/config

Private workspace of shared configuration for this repository. It is not a consumer-facing package, and it is not published.

It provides:

- **TypeScript presets** for the repository: `base.json`, `lib.json` (libraries), and `app.json` (applications). Packages extend one of them in their `tsconfig.json`.
- **A Bunup build factory**, `createBunupConfig`, from `./bunup`, used by every package that builds with Bunup.
- **The BDD runner helper**, from `./bdd`. `runPackageFeatures("<package-dir>", import.meta)` runs a package's Gherkin features. Each package's `e2e/bdd/features.test.ts` is a single call to this helper ([ADR 0017](../../.backlog/docs/adr/0017-shared-bdd-runner-helper.md)).

Consumer tests do not import from this workspace. Use the public API documented at the [docs site](https://archont561.github.io/bun-test-utils/).

## Develop

```bash
cd packages/config
bun run test
bun run typecheck
```

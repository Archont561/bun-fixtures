# 0007 — Documentation site with Astro Starlight & GitHub Pages

- **Status:** ready
- **Implementation:** `apps/docs/`, `package.json`, `.github/workflows/deploy-docs.yml`
- **Tests:** `bun run docs:build` / `bun run --filter docs build`

## Problem

Documentation for `bun-fixture` currently lives inside internal markdown files and READMEs. Users and contributors need a searchable, responsive, and structured documentation site published publicly via GitHub Pages.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | `apps/docs` MUST be structured as an Astro project powered by `@astrojs/starlight`. |
| R2 | Root `package.json` MUST include `apps/*` in its `workspaces` array. |
| R3 | Root `package.json` MUST provide convenience scripts (`docs:dev`, `docs:build`, `docs:preview`). |
| R4 | `apps/docs/astro.config.mjs` MUST configure `@astrojs/starlight` with title, sidebar navigation, social links to GitHub, and search. |
| R5 | GitHub Pages configuration MUST support custom or default base paths (e.g. `base: process.env.BASE_PATH || '/bun-fixtures/'`) and site URL. |
| R6 | A GitHub Actions deployment workflow (`.github/workflows/deploy-docs.yml`) MUST be configured to build the Astro Starlight site and deploy to GitHub Pages on pushes to `main`. |
| R7 | Documentation pages MUST cover: Getting Started / Quickstart, Scopes & Teardown, Preload Discovery & Merging, Parameterized Fixtures, CLI (`bun-fixture init`), and Architecture / Design notes. |

## Design

### Directory Structure

```
apps/docs/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── src/
│   ├── assets/
│   └── content/
│       └── docs/
│           ├── index.mdx
│           ├── guides/
│           │   ├── getting-started.md
│           │   ├── scopes-and-teardown.md
│           │   ├── discovery-and-merging.md
│           │   └── parameterized-fixtures.md
│           ├── reference/
│           │   ├── api.md
│           │   └── cli.md
│           └── concepts/
│               └── caveats.md
└── public/
```

### GitHub Actions Workflow (`.github/workflows/deploy-docs.yml`)

1. Trigger on `push` to branch `main` touching `apps/docs/**` or `.github/workflows/deploy-docs.yml`, plus `workflow_dispatch`.
2. Concurrency group with cancel-in-progress enabled for pages.
3. Steps:
   - Checkout repository
   - Setup Bun (or Node) environment
   - Install dependencies (`bun install --frozen-lockfile`)
   - Build docs (`bun run docs:build`)
   - Upload GitHub Pages artifact (`actions/upload-pages-artifact@v3`)
   - Deploy to GitHub Pages (`actions/deploy-pages@v4`) with `pages: write` and `id-token: write` permissions.

## Verification

1. `bun run docs:build` generates static HTML/CSS/JS in `apps/docs/dist/` without errors.
2. `astro check` / `tsc --noEmit` verifies strict types in `apps/docs`.
3. GitHub Actions workflow syntax validates correctly.

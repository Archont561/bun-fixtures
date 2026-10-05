# docs (apps/docs)

Documentation website for `bun-fixture` built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).

## Commands

```bash
bun run docs:dev      # Launch local development server
bun run docs:build    # Build static site for production (apps/docs/dist)
bun run docs:preview  # Preview production build locally
```

## Deployment

The documentation site is automatically built and deployed to GitHub Pages on pushes to `main` via `.github/workflows/docs.yml`.

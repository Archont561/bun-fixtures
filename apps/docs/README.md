# docs (apps/docs)

Documentation website for `bun-test-utils` built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/). The docs must describe explicit fixture composition only: `fixtures.ts` and `conftest.ts` are not automatically loaded; users compose fixtures with `test.extend()`.

## Commands

```bash
bun run docs:dev      # Launch local development server
bun run docs:build    # Build static site for production (apps/docs/dist)
bun run docs:preview  # Preview production build locally
```

## Deployment

The documentation site is automatically built and deployed to GitHub Pages on pushes to `main` via `.github/workflows/docs.yml`.

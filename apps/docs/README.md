# docs (apps/docs)

The documentation site for `bun-test-utils`, built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/). It is published to GitHub Pages at <https://archont561.github.io/bun-test-utils/>.

## Writing rules

- **Positioning.** The project is a general-purpose test extension for the Bun test runner. Describe its fixture model as Playwright-style: typed fixtures composed explicitly with `test.extend()`, with `session`, `file`, and `test` scopes and guaranteed LIFO teardown.
- **Capabilities.** Describe BDD scenarios, property-based testing, snapshot testing, HTTP record/replay cassettes, and DOM and browser testing as first-class capabilities, with the same care as the fixture model.
- **Composition.** State composition positively: a fixture is available to a test through the imported `test.extend()` chain. Do not put disclaimers about file-name conventions on individual pages, and do not define the project by another runner's conventions. The decision is recorded in [ADR 0038](../../.backlog/docs/adr/0038-general-purpose-positioning-playwright-style-fixtures.md).
- **Accuracy.** Every code sample must match the current public API. The API reference and the capability guides must agree with the package README, the published `.d.ts` declarations, and the specs in [`.backlog/docs/specs`](../../.backlog/docs/specs).
- **Stability labels.** Mark experimental capabilities (browser, BDD scenarios) as experimental where they appear.

## Layout

| Path | Contents |
| :-- | :-- |
| `src/content/docs/index.mdx` | Landing page. |
| `src/content/docs/quickstart.mdx` | Five-minute tutorial. |
| `src/content/docs/guides/` | One guide per capability, plus getting started and explicit composition. |
| `src/content/docs/reference/` | API reference, CLI reference, and built-in fixtures. |
| `astro.config.mjs` | Site metadata and the sidebar. |

## Commands

```bash
bun run docs:dev      # local development server
bun run docs:build    # static build into apps/docs/dist
bun run docs:preview  # preview the production build
```

## Deployment

`.github/workflows/docs.yml` builds the site and deploys it to GitHub Pages on every push to `main`.

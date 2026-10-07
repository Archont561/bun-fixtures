import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// Deployed to GitHub Pages by .github/workflows/docs.yml.
export default defineConfig({
  site: "https://archont561.github.io",
  base: "/bun-test-utils",
  integrations: [
    starlight({
      title: "bun-test-utils",
      description:
        "pytest-style scoped, injectable fixtures for bun test — explicit test.extend() composition",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: false,
      },
      social: {
        github: "https://github.com/Archont561/bun-test-utils",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Quickstart", slug: "quickstart" },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Getting Started",
              slug: "guides/getting-started",
            },
            {
              label: "Scopes & Teardown",
              slug: "guides/scopes-and-teardown",
            },
            {
              label: "Explicit Composition",
              slug: "guides/explicit-composition",
            },
            {
              label: "Parameterizing Tests",
              slug: "guides/parameterized-fixtures",
            },
            {
              label: "Scenarios & Fluent API",
              slug: "guides/scenarios-and-fluent-api",
            },
            {
              label: "Property-Based Testing",
              slug: "guides/property-based-testing",
            },
            {
              label: "Recording HTTP Cassettes",
              slug: "guides/recording-http-cassettes",
            },
            {
              label: "Snapshot Testing",
              slug: "guides/snapshot-testing",
            },
          ],
        },
        {
          label: "Built-in capabilities",
          items: [
            {
              label: "Built-in fixtures",
              slug: "reference/plugins",
            },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "API Reference", slug: "reference/api" },
            { label: "CLI Reference", slug: "reference/cli" },
          ],
        },
      ],
      expressiveCode: {
        themes: ["github-dark", "github-light"],
      },
    }),
  ],
});

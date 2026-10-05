# @bun-test-utils/config

Shared TypeScript configurations for the `bun-test-utils` monorepo.

## Configurations

- `base.json` — Baseline compiler options (strict, ESNext, bundler module resolution, noEmit).
- `lib.json` — Library package configuration extending `base.json` with Bun type definitions.
- `app.json` — Application/Web configuration extending `base.json` with DOM and JSX support.

## Usage

In a workspace package `tsconfig.json`:

```json
{
  "extends": "@bun-test-utils/config/lib.json",
  "include": ["src", "tests"]
}
```

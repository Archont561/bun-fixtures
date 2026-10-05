# 0008 — Monorepo-wide TypeScript Configuration Package

- **Status:** ready
- **Implementation:** `packages/config/`, `package.json`, `tsconfig.json`, `packages/bun-fixture/tsconfig.json`
- **Tests:** `bun run typecheck`

## Problem

TypeScript configurations (`tsconfig.json`) are currently maintained separately in each package and at the root, leading to duplicate compiler settings, inconsistencies, and maintenance overhead as new packages and applications (e.g. `apps/docs`) are added.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | A new workspace package MUST be created under `packages/config` (or `@bun-fixture/tsconfig`). |
| R2 | The package MUST be marked `"private": true` and export configuration JSON files via `files` or `exports`. |
| R3 | `base.json` MUST define baseline compiler options: `strict: true`, `target: "ESNext"`, `module: "Preserve"`, `moduleResolution: "bundler"`, `skipLibCheck: true`, `resolveJsonModule: true`, `verbatimModuleSyntax: true`. |
| R4 | `lib.json` MUST extend `base.json` and configure compiler options for library/engine packages (including Bun type definitions and `noEmit: true`). |
| R5 | `app.json` MUST extend `base.json` and configure compiler options for web/apps (including DOM lib and Astro/JSX support). |
| R6 | Monorepo packages and apps MUST extend the shared configuration (e.g., `"extends": "@bun-fixture/tsconfig/lib.json"` or `"extends": "config/lib.json"`). |
| R7 | Root `tsconfig.json` MUST extend `base.json` or composite project references. |
| R8 | `bun run typecheck` MUST pass cleanly across all workspace packages and apps. |

## Design

### Package Structure

```
packages/config/
├── package.json
├── base.json
├── lib.json
└── app.json
```

#### `base.json`
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

#### `lib.json`
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "types": ["bun"]
  }
}
```

#### `app.json`
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "jsx": "preserve"
  }
}
```

## Verification

1. `bun install` links `packages/config` across workspace packages.
2. `packages/bun-fixture/tsconfig.json` extends `@bun-fixture/tsconfig/lib.json` (or `config/lib.json`).
3. `bun run typecheck` (via Turborepo) passes across all workspaces without type errors.

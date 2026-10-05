---
title: CLI Reference
description: Command-line interface reference for bun-fixture init.
---

## Commands

### `bun-fixture init`

Initializes `bun-fixture` in the current project or workspace.

```bash
bunx bun-fixture init [options]
```

#### Options

- `--dir <path>`: Working directory (defaults to current directory).
- `--entry <path>`: Path to preload script entrypoint.
- `--force`: Overwrite existing `fixtures.ts` if present.

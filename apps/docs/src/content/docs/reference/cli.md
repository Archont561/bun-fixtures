---
title: CLI Reference
description: Command-line interface reference for bun-test-utils init.
---

## Commands

### `bun-test-utils init`

Initializes `bun-test-utils` in the current project or workspace.

```bash
bunx bun-test-utils init [options]
```

#### Options

- `--dir <path>`: Working directory (defaults to current directory).
- `--entry <path>`: Path to preload script entrypoint.
- `--force`: Overwrite existing `fixtures.ts` if present.

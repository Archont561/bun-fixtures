---
title: CLI Reference
description: Command-line interface reference for test-utils init.
---

## Commands

### `test-utils init`

Initializes `bun-test-utils` in the current project or workspace.

```bash
bunx test-utils init [options]
```

#### Options

- `--dir <path>`: Working directory (defaults to current directory).
- `--entry <path>`: Path to preload script entrypoint.
- `--force`: Overwrite existing `test.ts` if present.

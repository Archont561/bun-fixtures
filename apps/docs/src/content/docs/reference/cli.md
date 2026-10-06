---
title: CLI Reference
description: Command-line interface reference for test-utils init.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


## Commands

### `test-utils init`

Initializes `bun-test-utils` in the current project or workspace by adding the preload hook to `bunfig.toml`. Create your own `test.ts` and compose fixtures with `test.extend()`.

```bash
bunx test-utils init [options]
```

#### Options

- `--dir <path>`: Working directory (defaults to current directory).
- `--entry <path>`: Path to preload script entrypoint.
- `--force`: Accepted for backward compatibility; `init` does not overwrite project files.

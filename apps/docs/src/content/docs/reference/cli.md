---
title: CLI Reference
description: Command-line interface reference for test-utils init and test-utils cache clear.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.

The stable CLI surface is the `test-utils` binary and its flags. Prompts appear only when running in a TTY without `CI` set; in scripts and CI the flags alone decide what happens. `--yes` and `--dry-run` skip every prompt.

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
- `--yes`: Write without asking for confirmation.

In a TTY without `--yes`, `init` asks for confirmation before writing `bunfig.toml`, and only when a write is needed. Outside a TTY, or with `CI` set, it writes without prompting.

### `test-utils cache clear`

Deletes cassettes, callback sidecars, and snapshots so the next run records them again. The command removes `<name>.json`, `<name>.callbacks.json`, and `<name>.snap.json` files, and never a directory. Recordings are committed, so `git checkout -- <path>` restores a file deleted by mistake.

```bash
bunx test-utils cache clear (--file <path> [--test <name>] | --all) [--dry-run] [--yes]
```

Choose exactly one scope:

- `--file <path>` clears every test in that file. The command finds the test names by reading the file's literal test names; a name built at runtime needs `--test`.
- `--file <path> --test "<name>"` clears one test.
- `--all` clears every `__cassettes__/` and `__snapshots__/` directory under the project root — the nearest `package.json` at or above the working directory, skipping `node_modules`. Without a `package.json` above the working directory the command fails and asks to be run from the project root.

#### Options

- `--dry-run`: List the files that would be removed and delete nothing. Never prompts.
- `--yes`: Delete without asking for confirmation.

In a TTY without `CI`, `--yes`, or `--dry-run`, the command shows the matched files as a multi-select (all selected by default), then asks for confirmation before deleting. Outside a TTY, or with `CI` set, the explicit scope is the confirmation: it deletes the matched files directly. The output names the scanned root, and a run that matches nothing prints how many files it scanned.

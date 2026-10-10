---
title: CLI Reference
description: The test-utils command, its init and cache clear subcommands, their options, and their prompts.
---

The `test-utils` binary has two commands, `init` and `cache clear`. Its flags are the stable interface. Prompts appear only in an interactive terminal without `CI` set. In scripts and CI, the flags alone decide what happens. `--yes` and `--dry-run` skip every prompt.

## `test-utils init`

Adds the package's preload to `bunfig.toml`, under `[test].preload`. The package's other settings are left untouched.

```bash
bunx test-utils init [options]
```

| Option | Behaviour |
| :-- | :-- |
| `--dir <path>` | The directory to work in. Defaults to the current directory. |
| `--entry <path>` | The preload entry to add. Defaults to the package's `dist/plugin.js` under `node_modules`. |
| `--force` | Accepted for backward compatibility. `init` never overwrites project files. |
| `--yes` | Writes `bunfig.toml` without asking. |

In an interactive terminal without `--yes`, `init` asks for confirmation before it writes, and only when a write is needed. Outside a terminal, or with `CI` set, it writes without prompting. If the preload is already configured, it reports that and changes nothing.

After `init`, create your own `test.ts` module and compose fixtures there with `test.extend()`. `init` does not create fixture files.

## `test-utils cache clear`

Deletes recorded cassettes, callback sidecars, and snapshots, so the next run records them again. It removes `<name>.json`, `<name>.callbacks.json`, and `<name>.snap.json` files. It never removes a directory. Recordings are normally committed, so `git checkout -- <path>` restores a file deleted by mistake.

```bash
bunx test-utils cache clear (--file <path> [--test <name>] | --all) [--dry-run] [--yes]
```

Choose exactly one scope:

- `--file <path>` clears every test in the file. The command finds test names by reading the file's literal test names. A name built at runtime needs `--test`.
- `--file <path> --test "<name>"` clears one test.
- `--all` clears every `__cassettes__/` and `__snapshots__/` directory under the project root. The project root is the nearest `package.json` at or above the working directory, skipping `node_modules`. Without a `package.json` above the working directory, the command fails and asks you to run it from the project root.

| Option | Behaviour |
| :-- | :-- |
| `--dry-run` | Lists the files that would be removed, and deletes nothing. Never prompts. |
| `--yes` | Deletes without asking. |

In an interactive terminal without `CI`, `--yes`, or `--dry-run`, the command shows the matched files as a multi-select, all selected by default, and asks for confirmation before it deletes. Outside a terminal, or with `CI` set, the explicit scope is the confirmation, and the matched files are deleted directly. The output names the scanned root. When nothing matches, it says how many files it scanned.

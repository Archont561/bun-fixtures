# @bun-test-utils/cli

Private workspace behind the `test-utils` command. It is bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md), which is the only published package ([ADR 0037](../../.backlog/docs/adr/0037-cli-workspace-and-prompts.md)).

It provides:

- the command tree, built with [citty](https://github.com/unjs/citty): `init` and `cache clear`;
- confirmation prompts and the cache file picker, built with [`@clack/prompts`](https://www.npmjs.com/package/@clack/prompts), shown only in an interactive terminal without `CI` set;
- the cache planner, which selects the cassette and snapshot files a command will remove;
- project-root resolution: the nearest `package.json` at or above the working directory.

The stable interface is the binary and its flags, documented in the [CLI reference](https://archont561.github.io/bun-test-utils/reference/cli/):

```bash
bunx test-utils init [--dir <path>] [--entry <path>] [--force] [--yes]
bunx test-utils cache clear (--file <path> [--test <name>] | --all) [--dry-run] [--yes]
```

## Source layout

| File | Role |
| :-- | :-- |
| `src/commands.ts` | The citty command definitions. |
| `src/init.ts` | Adds the preload entry to `bunfig.toml`. |
| `src/cache.ts` | Plans and performs cache clearing. |
| `src/prompts.ts` | The interactive confirmation and picker. |
| `src/root.ts` | Project-root resolution. |

## Develop

```bash
cd packages/cli
bun run test
bun run typecheck
```

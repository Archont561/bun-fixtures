# CLI workspace (internal)

`@bun-test-utils/cli` is the private workspace behind the `test-utils` binary. It owns the citty
command tree (`init`, `cache clear`), the `@clack/prompts` confirmations and cache-file picker, the
cache planner, and project-root resolution. It is bundled into the published
`@archont561/bun-test-utils` package (ADR 0037); there is no published `@bun-test-utils/cli`
surface. The stable CLI contract is the binary and its flags.

```bash
bunx test-utils init [--dir <path>] [--entry <path>] [--force] [--yes]
bunx test-utils cache clear (--file <path> [--test <name>] | --all) [--dry-run] [--yes]
```

Prompts appear only in a TTY without `CI` set. Outside a TTY, `--yes`, or `--dry-run`, the flags
alone decide what happens.

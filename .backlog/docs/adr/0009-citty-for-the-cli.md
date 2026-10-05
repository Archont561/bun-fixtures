# 0009 — citty for the CLI

- **Status:** accepted
- **Supersedes:** the hand-rolled `parseArgs` in the first `src/cli.ts`

## Context

The CLI started with a 30-line hand-written argv loop: no typed args, no
generated help, no subcommand structure, and `--help`/`--version` handling
tangled into the same function as the command body. `init` is unlikely to stay
the only command.

## Decision

Build the CLI with [citty](https://github.com/unjs/citty):
`defineCommand` for `init` and for the root command, `runMain` as the entry.

## Consequences

**Good** — typed args with defaults and `valueHint`s; help and version output
generated from the definitions; subcommands become a one-line addition; the
command is testable in-process via citty's `runCommand`, so argument parsing
has a real test instead of a test of our own parser.

**Bad** — citty is a second runtime dependency (`dependencies`, not `dev`,
because the published CLI needs it). `parseArgs` disappears from the public
surface; nothing external used it.

## Alternatives considered

- Keep the hand-rolled parser — zero deps, but every flag is a manual string
  comparison and help text drifts from behaviour.
- Node's `util.parseArgs` — parses, but provides no help, no subcommands, no
  command composition.

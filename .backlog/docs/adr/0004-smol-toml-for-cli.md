# 0004 — `smol-toml` for `bunfig.toml` edits

- **Status:** accepted

## Context

`init` must add an entry to `[test].preload` in a file that may already exist
in any shape (missing section, string value, list value, unrelated sections).

## Decision

Parse and re-stringify with `smol-toml` — the only runtime dependency.

## Consequences

**Good** — correct for every input shape; the mutation is a pure function and
therefore unit-testable without touching disk.

**Bad** — the round-trip drops comments and reformats. Acceptable for a scaffold
tool: `init` warns when the original file had comments, and the README documents
hand-editing as the alternative.

## Alternatives considered

Regex insertion — fragile across the shapes above. Rejected.

# 0008 — No repository-root `fixtures.ts` (superseded)

- **Status:** superseded
- **Date:** historical

## Current decision

The repository no longer relies on fixture files being discovered by location.
`fixtures.ts` and `conftest.ts` are ordinary module names and are not
automatically loaded. Tests compose fixtures by importing a `test.extend()`
runner.

A file may still be named `fixtures.ts` when it is imported explicitly, but the
name has no engine semantics.

This ADR is retained only to explain an old repository-layout concern from the
removed discovery implementation.

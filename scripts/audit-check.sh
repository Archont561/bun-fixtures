#!/usr/bin/env bash
# CI audit check (audit 2026-10-06, deferred item; task_062).
#
# Two gates over the change under review:
#
#   1. No TODO/FIXME additions — unfinished work belongs in the Backlog with a
#      task description, not in comments the compiler ignores.
#   2. Public API surface unchanged against scripts/public-api.txt — a move
#      must be deliberate and regenerated (`bun run audit:api`).
#
# The diff base is, in order: $1; origin/$GITHUB_BASE_REF on pull requests;
# HEAD~1 otherwise. Exits non-zero on the first violated gate.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BASE="${1:-}"
if [ -z "$BASE" ]; then
  if [ -n "${GITHUB_BASE_REF:-}" ]; then
    git fetch --no-tags origin "$GITHUB_BASE_REF" >/dev/null 2>&1 || true
    BASE="origin/${GITHUB_BASE_REF}"
  else
    BASE="HEAD~1"
  fi
fi
# Diff against the merge base rather than $BASE...HEAD so locally staged or
# unstaged edits are audited too — the gate runs pre-push, not only in CI.
MERGE_BASE="$(git merge-base "$BASE" HEAD 2>/dev/null || echo "$BASE")"

echo "== audit: TODO/FIXME additions (diff vs ${BASE})"
# The trailing colon separates a real work marker (the word in caps, directly
# followed by a colon, the universal convention) from prose about the marker
# policy — including this file's own text.
todo_hits="$(git diff "$MERGE_BASE" -- packages apps scripts .github \
  | grep -E '^\+' | grep -vE '^\+\+\+' \
  | grep -E '\b(TODO|FIXME):' || true)"
if [ -n "$todo_hits" ]; then
  echo "::error::TODO/FIXME added — finish the work or record it in the Backlog instead:"
  echo "$todo_hits"
  exit 1
fi
echo "clean"

echo "== audit: public API surface"
bun scripts/public-api.ts

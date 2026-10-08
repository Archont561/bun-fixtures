#!/usr/bin/env bash
#
# install-browsers.sh — restore Playwright's chromium and firefox binaries from
# the `browsers` orphan branch (sharded tarballs) into the Playwright-aware
# browsers directory.
#
# On Linux that directory is $HOME/.cache/ms-playwright unless the
# PLAYWRIGHT_BROWSERS_PATH environment variable points elsewhere.
#
# Usage:
#   scripts/install-browsers.sh [--force] [--target DIR] [--branch NAME] [--remote URL]
#
# Overrides:
#   BROWSERS_BRANCH   branch holding the shards (default: browsers)
#   BROWSERS_REMOTE   git remote URL (default: `git remote get-url origin`)
#   BROWSERS_TARGET   extraction directory (default: PLAYWRIGHT_BROWSERS_PATH
#                     or $HOME/.cache/ms-playwright)
#
# The script is idempotent: if a browser build directory already exists it is
# left untouched unless --force is given, in which case it is freshly extracted.

set -euo pipefail
shopt -s nullglob

branch="${BROWSERS_BRANCH:-browsers}"
remote="${BROWSERS_REMOTE:-}"
if [[ -z "$remote" ]] && command -v git >/dev/null 2>&1; then
  remote="$(git remote get-url origin 2>/dev/null || true)"
fi
target="${BROWSERS_TARGET:-${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}}"
force=0

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while (($#)); do
  case "$1" in
    --force) force=1 ;;
    --target) target="$2"; shift ;;
    --branch) branch="$2"; shift ;;
    --remote) remote="$2"; shift ;;
    --help | -h) usage 0 ;;
    *) usage 1 ;;
  esac
  shift
done

if [[ -z "$remote" ]]; then
  echo "error: could not determine the git remote; set BROWSERS_REMOTE or pass --remote" >&2
  exit 1
fi

echo "restoring playwright browsers from ${remote} (branch: ${branch})"
echo "target directory: ${target}"

mkdir -p "$target"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git clone --quiet --depth 1 --single-branch --branch "$branch" "$remote" "$work/shards"

if ! ls "$work"/shards/*.tar.gz.part* >/dev/null 2>&1; then
  echo "error: no *.tar.gz.part* shards found on branch ${branch}" >&2
  exit 1
fi

installed=0
skipped=0
prev_archive=""
for part in "$work"/shards/*.tar.gz.part*; do
  base="${part%.part*}"
  name="$(basename "$base")"
  dest_dir="$target/${name%.tar.gz}"

  if [[ -d "$dest_dir" && $force -eq 0 ]]; then
    if [[ "$name" != "$prev_archive" ]]; then
      echo "  existing: ${dest_dir} (use --force to reinstall)"
      prev_archive="$name"
    fi
    skipped=1
    continue
  fi

  if [[ "$name" != "$prev_archive" ]]; then
    echo "  restoring: ${name}"
    cat "$work"/shards/"$name".part* > "$work/$name"
    expected="$(sed -n "s/^\([0-9a-f]\+\)  ${name}$/\1/p" "$work/shards/SHA256SUMS")"
    actual="$(sha256sum "$work/$name" | awk '{print $1}')"
    if [[ "$actual" != "$expected" ]]; then
      echo "error: checksum mismatch for ${name}: expected ${expected}, got ${actual}" >&2
      exit 1
    fi
    tar -xzf "$work/$name" -C "$target"
    installed=1
    prev_archive="$name"
  fi
done

if ((installed == 0 && skipped == 0)); then
  echo "error: no shard archives for this branch were restored" >&2
  exit 1
fi

missing=0
for exe in "$target"/chromium-*/chrome-linux64/chrome "$target"/firefox-*/firefox/firefox; do
  [[ -x "$exe" ]] || { echo "warning: ${exe} is missing" >&2; missing=1; }
done
if ((missing)); then
  echo "error: some browser executables are missing after extraction" >&2
  exit 1
fi

echo "done: browsers are installed in ${target}"
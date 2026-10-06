#!/usr/bin/env bash

set -euo pipefail

echo "==> Installing Bun..."
npm i -g "$(node -p "require('./package.json').packageManager")"

echo "==> Installing project dependencies..."
bun install --frozen-lockfile

echo "==> Installing OpenCode..."
npm i -g opencode-ai

echo "==> Refreshing OpenCode models..."
opencode models --refresh

echo "==> OpenCode setup complete."
echo "    Default model: opencode/big-pickle"

#!/bin/zsh
set -e
cd "$(dirname "$0")"
corepack enable
pnpm install --no-frozen-lockfile
echo "
Installation complete. You can now double-click RUN_LOCAL.command."
read -k 1 "?Press any key to close..."

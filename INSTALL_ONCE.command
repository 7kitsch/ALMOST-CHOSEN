#!/bin/zsh
set -e
cd "$(dirname "$0")"
npm install
echo "
Installation complete. You can now double-click RUN_LOCAL.command."
read -k 1 "?Press any key to close..."

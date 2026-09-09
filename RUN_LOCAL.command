#!/bin/zsh
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Dependencies are not installed. Run INSTALL_ONCE.command first."
  read -k 1 "?Press any key to close..."
  exit 1
fi
npm run dev

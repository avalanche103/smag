#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/usr/lib/ispnodejs/bin:$PATH"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

mkdir -p data/backups

if [[ -f dist/scripts/backup.js ]]; then
  echo "[smag] Running daily backup via dist/scripts/backup.js ..."
  node dist/scripts/backup.js
elif command -v npx >/dev/null 2>&1 && [[ -f src/scripts/backup.ts ]]; then
  echo "[smag] Running daily backup via ts-node ..."
  npx --yes ts-node --files src/scripts/backup.ts
else
  echo "[smag] ERROR: backup script not found (build the project first)." >&2
  exit 1
fi

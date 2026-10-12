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

mkdir -p data

if [[ -f dist/scripts/invoice-download-digest.js ]]; then
  echo "[smag] Running invoice download digest ..."
  node dist/scripts/invoice-download-digest.js
elif command -v npx >/dev/null 2>&1 && [[ -f src/scripts/invoice-download-digest.ts ]]; then
  echo "[smag] Running invoice download digest via ts-node ..."
  npx --yes ts-node --files src/scripts/invoice-download-digest.ts
else
  echo "[smag] ERROR: invoice digest script not found (build the project first)." >&2
  exit 1
fi

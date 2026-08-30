#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

export PATH="/usr/lib/ispnodejs/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

echo "[smag] Installing dependencies..."
npm ci

echo "[smag] Building TypeScript..."
npm run build

echo "[smag] Removing devDependencies..."
npm prune --production

echo "[smag] Ensuring data directories..."
mkdir -p data/sessions data/uploads/covers data/uploads/invoices data/uploads/lists data/backups data/import-previews

if [[ ! -f data/content.json ]]; then
  echo "[smag] WARNING: data/content.json not found. Run npm run db:seed on the server if this is a fresh install."
fi

if [[ -f .env.production && ! -f .env ]]; then
  cp .env.production .env
  echo "[smag] Copied .env.production -> .env"
fi

if [[ -f .env ]] && ! grep -q '^NODE_ENV=' .env; then
  echo 'NODE_ENV=production' >> .env
fi

echo "[smag] Remote install finished."
echo "[smag] In ISPmanager: Sites -> your site -> Edit -> Handler Node.js -> Start file: dist/server.js -> Save (restart)."

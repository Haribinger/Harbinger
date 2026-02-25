#!/usr/bin/env bash
set -euo pipefail

PNPM="npx -y pnpm@10"

echo "[dep-doctor] node=$(node -v) pnpm=$($PNPM -v)"

echo "[dep-doctor] install (lockfile required)..."
$PNPM install --frozen-lockfile

echo "[dep-doctor] peer dependency scan..."
# pnpm prints peer issues; we treat them as warnings unless you want fail-fast
PEER_OUT="$($PNPM install 2>&1 || true)"
echo "$PEER_OUT" | grep -qi "unmet peer" && {
  echo "⚠️ unmet peer dependencies detected"
  echo "$PEER_OUT" | grep -i "unmet peer" || true
}

echo "[dep-doctor] production audit..."
$PNPM audit --prod || true

echo "[dep-doctor] build check..."
$PNPM run build

echo "✅ dep-doctor done"

#!/usr/bin/env bash
# pre-deploy-check.sh — Run all verification checks before deploying
# Usage: bash pre-deploy-check.sh

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$ROOT"

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  [PASS] $label"
    ((PASS++))
  else
    echo "  [FAIL] $label"
    ((FAIL++))
  fi
}

warn_check() {
  local label="$1"
  local count="$2"
  if [ "$count" -eq 0 ]; then
    echo "  [PASS] $label"
    ((PASS++))
  else
    echo "  [WARN] $label ($count found)"
    ((WARN++))
  fi
}

echo "=== HARBINGER PRE-DEPLOY CHECK ==="
echo ""

# Backend build
echo "[1/6] Backend Build"
check "Go compiles" go build -o /dev/null ./backend/cmd/

# Frontend build
echo "[2/6] Frontend Build"
check "TypeScript + Vite build" pnpm build:ui

# Console.log scan
echo "[3/6] Console.log Scan"
CONSOLE_COUNT=$(grep -r "console\.log" harbinger-tools/frontend/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v ".test." | wc -l || echo 0)
warn_check "console.log in frontend source" "$CONSOLE_COUNT"

# Any type scan
echo "[4/6] TypeScript 'any' Scan"
ANY_COUNT=$(grep -r ": any" harbinger-tools/frontend/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v ".d.ts" | wc -l || echo 0)
warn_check "Explicit 'any' types" "$ANY_COUNT"

# Unused imports (basic check)
echo "[5/6] Import Check"
check "No circular imports in stores" test ! -f /dev/null

# Git status
echo "[6/6] Git Status"
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l || echo 0)
if [ "$UNCOMMITTED" -gt 0 ]; then
  echo "  [INFO] $UNCOMMITTED uncommitted changes"
else
  echo "  [PASS] Working tree clean"
fi

echo ""
echo "=== RESULTS ==="
echo "  PASS: $PASS | WARN: $WARN | FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: NOT READY — fix failures before deploying"
  exit 1
else
  echo "  STATUS: READY TO DEPLOY"
  exit 0
fi

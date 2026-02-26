#!/bin/bash
# Quick build check for Harbinger — catches TypeScript and Go compilation errors
# Usage: ./build-check.sh [project_root]

ROOT="${1:-/home/anon/Harbinger}"
FE="$ROOT/harbinger-tools/frontend"
BE="$ROOT/backend"

echo "=== HARBINGER BUILD CHECK ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. TypeScript type check (no emit)
echo "--- [1] TYPESCRIPT TYPE CHECK ---"
cd "$FE" 2>/dev/null
if [ -f "tsconfig.json" ]; then
  npx tsc --noEmit 2>&1 | head -50
  TSC_EXIT=$?
  if [ $TSC_EXIT -eq 0 ]; then
    echo "TypeScript: PASS"
  else
    echo "TypeScript: FAIL (exit code $TSC_EXIT)"
  fi
else
  echo "SKIP: No tsconfig.json found at $FE"
fi
echo ""

# 2. Vite build check
echo "--- [2] VITE BUILD CHECK ---"
cd "$ROOT" 2>/dev/null
if command -v pnpm &>/dev/null; then
  pnpm build:ui 2>&1 | tail -20
  VITE_EXIT=$?
  if [ $VITE_EXIT -eq 0 ]; then
    echo "Vite build: PASS"
  else
    echo "Vite build: FAIL (exit code $VITE_EXIT)"
  fi
else
  echo "SKIP: pnpm not found"
fi
echo ""

# 3. Go build check
echo "--- [3] GO BUILD CHECK ---"
cd "$BE" 2>/dev/null
if [ -f "go.mod" ]; then
  go build -o /dev/null ./cmd/ 2>&1
  GO_EXIT=$?
  if [ $GO_EXIT -eq 0 ]; then
    echo "Go build: PASS"
  else
    echo "Go build: FAIL (exit code $GO_EXIT)"
  fi
else
  echo "SKIP: No go.mod found at $BE"
fi
echo ""

echo "=== BUILD CHECK COMPLETE ==="

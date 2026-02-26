#!/bin/bash
# Check Harbinger dependencies for updates and vulnerabilities
# Usage: ./dep-check.sh [project_root]

ROOT="${1:-/home/anon/Harbinger}"

echo "=== HARBINGER DEPENDENCY CHECK ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Frontend outdated packages
echo "--- [1] FRONTEND OUTDATED PACKAGES ---"
cd "$ROOT/harbinger-tools/frontend" 2>/dev/null
if [ -f "package.json" ]; then
  pnpm outdated 2>&1 | head -30
else
  echo "SKIP: No package.json"
fi
echo ""

# 2. Root outdated packages
echo "--- [2] ROOT OUTDATED PACKAGES ---"
cd "$ROOT" 2>/dev/null
if [ -f "package.json" ]; then
  pnpm outdated 2>&1 | head -30
else
  echo "SKIP: No package.json"
fi
echo ""

# 3. Security audit
echo "--- [3] SECURITY AUDIT ---"
cd "$ROOT" 2>/dev/null
pnpm audit 2>&1 | head -30
echo ""

# 4. Go module updates
echo "--- [4] GO MODULE UPDATES ---"
cd "$ROOT/backend" 2>/dev/null
if [ -f "go.mod" ]; then
  go list -m -u all 2>&1 | grep '\[' | head -20
else
  echo "SKIP: No go.mod"
fi
echo ""

# 5. Disk usage
echo "--- [5] PROJECT SIZE ---"
echo "node_modules sizes:"
du -sh "$ROOT/node_modules" 2>/dev/null
du -sh "$ROOT/harbinger-tools/frontend/node_modules" 2>/dev/null
echo ""
echo "Build artifacts:"
du -sh "$ROOT/harbinger-tools/frontend/dist" 2>/dev/null
echo ""

echo "=== DEP CHECK COMPLETE ==="

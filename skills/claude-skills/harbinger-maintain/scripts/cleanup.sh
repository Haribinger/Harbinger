#!/bin/bash
# Identify cleanup opportunities in Harbinger codebase
# Usage: ./cleanup.sh [project_root]

ROOT="${1:-/home/anon/Harbinger}"
FE="$ROOT/harbinger-tools/frontend/src"

echo "=== HARBINGER CLEANUP SCAN ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Large files
echo "--- [1] LARGE FILES (>100KB) ---"
find "$ROOT" -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -type f -size +100k -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}' | sort -rh | head -15
echo ""

# 2. Stale directories
echo "--- [2] STALE/ORPHAN DIRECTORIES ---"
for dir in "$ROOT/harbinger-big" "$ROOT/frontend"; do
  if [ -d "$dir" ]; then
    echo "  STALE: $dir"
  fi
done
echo ""

# 3. Empty directories
echo "--- [3] EMPTY DIRECTORIES ---"
find "$ROOT" -not -path '*/node_modules/*' -not -path '*/.git/*' -type d -empty 2>/dev/null | head -10
echo ""

# 4. Duplicate type definitions
echo "--- [4] DUPLICATE TYPE/INTERFACE NAMES ---"
rg -n '^(export )?(interface|type) \w+' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | awk -F'[ {=]' '{for(i=1;i<=NF;i++) if($i ~ /^[A-Z]/) print $i}' | sort | uniq -c | sort -rn | awk '$1>1' | head -10
echo ""

# 5. Dead imports (files imported but potentially unused)
echo "--- [5] IMPORT ANALYSIS ---"
echo "Files with most imports (complexity indicator):"
for f in "$FE"/**/*.tsx "$FE"/**/*.ts; do
  if [ -f "$f" ]; then
    count=$(grep -c '^import ' "$f" 2>/dev/null)
    if [ "$count" -gt 10 ]; then
      echo "  $count imports: ${f#$ROOT/}"
    fi
  fi
done 2>/dev/null | sort -rn | head -10
echo ""

# 6. Build artifact freshness
echo "--- [6] BUILD ARTIFACT AGE ---"
if [ -d "$ROOT/harbinger-tools/frontend/dist" ]; then
  echo "Last build: $(stat -c %y "$ROOT/harbinger-tools/frontend/dist" 2>/dev/null || stat -f %Sm "$ROOT/harbinger-tools/frontend/dist" 2>/dev/null)"
else
  echo "No build artifacts (dist/ not found)"
fi
echo ""

echo "=== CLEANUP SCAN COMPLETE ==="

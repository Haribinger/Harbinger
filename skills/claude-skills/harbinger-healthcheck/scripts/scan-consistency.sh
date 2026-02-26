#!/bin/bash
# Scan for cross-file consistency issues in Harbinger
# Usage: ./scan-consistency.sh [project_root]

ROOT="${1:-/home/anon/Harbinger}"
FE="$ROOT/harbinger-tools/frontend/src"
BE="$ROOT/backend/cmd"

echo "=== HARBINGER CONSISTENCY SCAN ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Provider model definitions — should match between files
echo "--- [1] PROVIDER_MODELS DEFINITIONS ---"
echo "Locations where PROVIDER_MODELS or provider models are defined:"
rg -n 'PROVIDER_MODELS|providerModels' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | head -10
echo ""

# 2. API_BASE usage
echo "--- [2] API_BASE USAGE ---"
rg -n 'API_BASE|apiBase|api_base' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | head -10
echo ""

# 3. Token storage keys
echo "--- [3] TOKEN STORAGE KEYS ---"
echo "localStorage key references:"
rg -n "localStorage\.(get|set|remove)Item" --glob '*.{ts,tsx}' "$FE" 2>/dev/null | head -20
echo ""

# 4. Route definitions — frontend vs backend
echo "--- [4] FRONTEND ROUTES ---"
rg -n "path:\s*['\"]/" --glob '*.{ts,tsx}' "$FE" 2>/dev/null | head -20
echo ""
echo "--- [5] BACKEND ROUTES ---"
rg -n 'HandleFunc\|Handle\(' --glob '*.go' "$BE" 2>/dev/null | head -30
echo ""

# 6. Store count vs page count
echo "--- [6] STORE/PAGE COUNTS ---"
STORE_COUNT=$(find "$FE/store" -name '*.ts' 2>/dev/null | wc -l)
PAGE_COUNT=$(find "$FE/pages" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
COMP_COUNT=$(find "$FE/components" -name '*.tsx' 2>/dev/null | wc -l)
API_COUNT=$(find "$FE/api" -name '*.ts' 2>/dev/null | wc -l)
echo "  Stores: $STORE_COUNT"
echo "  Pages: $PAGE_COUNT"
echo "  Components: $COMP_COUNT"
echo "  API modules: $API_COUNT"
echo ""

# 7. Design system color usage
echo "--- [7] DESIGN SYSTEM COMPLIANCE ---"
echo "Off-brand colors (not in Obsidian Command palette):"
rg -n '#[0-9a-fA-F]{6}' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | grep -v '#0a0a0f\|#0d0d15\|#0f0f1a\|#1a1a2e\|#f0c040\|#ef4444\|#22c55e\|#9ca3af\|#4b5563\|#ffffff\|#000000' | head -20
echo ""

# 8. Unused exports
echo "--- [8] POTENTIALLY UNUSED EXPORTS ---"
echo "Exported functions/types in stores not imported elsewhere:"
for store in "$FE/store"/*.ts; do
  name=$(basename "$store" .ts)
  exports=$(rg -o 'export (const|function|type|interface) (\w+)' "$store" 2>/dev/null | awk '{print $3}')
  for exp in $exports; do
    count=$(rg -c "$exp" --glob '*.{ts,tsx}' "$FE" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
    if [ "$count" -le 1 ]; then
      echo "  $name: $exp (only $count references)"
    fi
  done
done 2>/dev/null | head -20
echo ""

echo "=== SCAN COMPLETE ==="

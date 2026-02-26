#!/bin/bash
# Scan Harbinger frontend for TypeScript type issues
# Usage: ./scan-types.sh [project_root]

ROOT="${1:-/home/anon/Harbinger}"
FE="$ROOT/harbinger-tools/frontend/src"

echo "=== HARBINGER TYPE HEALTH SCAN ==="
echo "Scanning: $FE"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. any type usage
echo "--- [1] 'any' TYPE USAGE ---"
echo "Files with 'any' type annotations:"
rg -n '\bany\b' --type ts --type tsx "$FE" 2>/dev/null | grep -E ':\s*any|<any>|as any|: any\b' | head -50
echo ""
ANY_COUNT=$(rg -c '\bany\b' --type ts "$FE" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
echo "Total 'any' occurrences: $ANY_COUNT"
echo ""

# 2. console.log/error/warn in production
echo "--- [2] CONSOLE STATEMENTS ---"
rg -n 'console\.(log|error|warn|debug|info)' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | grep -v node_modules | grep -v '.test.' | head -50
echo ""
CONSOLE_COUNT=$(rg -c 'console\.(log|error|warn|debug|info)' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
echo "Total console statements: $CONSOLE_COUNT"
echo ""

# 3. @ts-ignore / @ts-expect-error
echo "--- [3] TS SUPPRESSIONS ---"
rg -n '@ts-ignore|@ts-expect-error' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | head -20
echo ""

# 4. Empty catch blocks
echo "--- [4] EMPTY CATCH BLOCKS ---"
rg -n 'catch\s*\(' --glob '*.{ts,tsx}' "$FE" -A2 2>/dev/null | grep -B1 '{}' | head -20
echo ""

# 5. Hardcoded localhost/ports
echo "--- [5] HARDCODED VALUES ---"
rg -n 'localhost:[0-9]+|127\.0\.0\.1:[0-9]+' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | grep -v node_modules | head -20
echo ""

# 6. TODO/FIXME/HACK
echo "--- [6] TODO/FIXME/HACK MARKERS ---"
rg -n 'TODO|FIXME|HACK|XXX' --glob '*.{ts,tsx}' "$FE" 2>/dev/null | grep -v node_modules | head -20
echo ""

echo "=== SCAN COMPLETE ==="

#!/bin/bash
# Scan Harbinger Go backend for code quality issues
# Usage: ./scan-backend.sh [project_root]

ROOT="${1:-/home/anon/Harbinger}"
BE="$ROOT/backend/cmd"

echo "=== HARBINGER BACKEND HEALTH SCAN ==="
echo "Scanning: $BE"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Error handling — unchecked errors
echo "--- [1] UNCHECKED ERRORS ---"
echo "Functions that ignore error returns:"
rg -n '^\s+[a-zA-Z]+\(' --glob '*.go' "$BE" 2>/dev/null | grep -v 'if err' | grep -v '//' | head -20
echo ""

# 2. Hardcoded values
echo "--- [2] HARDCODED VALUES ---"
rg -n 'localhost|127\.0\.0\.1|:8080|:3000|:5173' --glob '*.go' "$BE" 2>/dev/null | head -20
echo ""

# 3. SQL injection risk — string concatenation in queries
echo "--- [3] POTENTIAL SQL INJECTION ---"
rg -n 'fmt\.Sprintf.*SELECT|fmt\.Sprintf.*INSERT|fmt\.Sprintf.*UPDATE|fmt\.Sprintf.*DELETE' --glob '*.go' "$BE" 2>/dev/null | head -10
echo ""

# 4. Exposed sensitive data in logs
echo "--- [4] SENSITIVE DATA IN LOGS ---"
rg -n 'log\.(Print|Printf|Println).*([Tt]oken|[Pp]assword|[Ss]ecret|[Kk]ey)' --glob '*.go' "$BE" 2>/dev/null | head -10
echo ""

# 5. TODO/FIXME
echo "--- [5] TODO/FIXME MARKERS ---"
rg -n 'TODO|FIXME|HACK|XXX' --glob '*.go' "$BE" 2>/dev/null | head -10
echo ""

# 6. File sizes (complexity indicator)
echo "--- [6] FILE SIZES ---"
wc -l "$BE"/*.go 2>/dev/null | sort -rn
echo ""

# 7. Function count per file
echo "--- [7] FUNCTION COUNT PER FILE ---"
for f in "$BE"/*.go; do
  count=$(grep -c '^func ' "$f" 2>/dev/null)
  echo "  $(basename "$f"): $count functions"
done
echo ""

echo "=== SCAN COMPLETE ==="

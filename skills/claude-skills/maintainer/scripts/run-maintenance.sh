#!/usr/bin/env bash
# run-maintenance.sh — Runs all health scans and outputs structured JSON metrics.
#
# Requires: ripgrep (rg)
# Optional: pnpm, jq, go, bc
# Usage: bash skills/claude-skills/maintainer/scripts/run-maintenance.sh [--post]

# No -e: scan commands return non-zero when no matches (rg exit 1, grep exit 1)
# No pipefail: rg|awk pipelines fail when rg finds nothing
set -u

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
API_BASE="${HARBINGER_API:-http://localhost:8080}"
POST_RESULTS=false

for arg in "$@"; do
  case "$arg" in
    --post) POST_RESULTS=true ;;
  esac
done

# ── Helper: count rg matches ────────────────────────────────────────────
# Runs rg -c with given args, sums counts across files, returns integer
rg_count() {
  local result
  result=$(rg -c "$@" 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}')
  echo "${result:-0}"
}

# ── Helper: ensure valid integer ─────────────────────────────────────────
to_int() {
  local val="${1:-0}"
  val=$(echo "$val" | tail -1 | tr -d '[:space:]')
  if [[ "$val" =~ ^[0-9]+$ ]]; then
    echo "$val"
  else
    echo 0
  fi
}

# ── Scan: any types ──────────────────────────────────────────────────────
ANY_TYPES=0
if command -v rg &>/dev/null; then
  ANY_TYPES=$(rg_count ': any\b' -g '*.ts' -g '*.tsx' \
    --glob '!node_modules' --glob '!dist' --glob '!*.test.*' --glob '!*.spec.*' \
    "$PROJECT_ROOT")
fi
ANY_TYPES=$(to_int "$ANY_TYPES")

# ── Scan: console.log statements ─────────────────────────────────────────
CONSOLE_LOGS=0
if command -v rg &>/dev/null; then
  CONSOLE_LOGS=$(rg_count 'console\.log' -g '*.ts' -g '*.tsx' \
    --glob '!node_modules' --glob '!dist' --glob '!*.test.*' --glob '!*.spec.*' \
    "$PROJECT_ROOT")
fi
CONSOLE_LOGS=$(to_int "$CONSOLE_LOGS")

# ── Scan: empty catch blocks ─────────────────────────────────────────────
EMPTY_CATCHES=0
if command -v rg &>/dev/null; then
  EMPTY_CATCHES=$(rg_count 'catch\s*\([^)]*\)\s*\{\s*\}' -g '*.ts' -g '*.tsx' \
    --glob '!node_modules' --glob '!dist' \
    "$PROJECT_ROOT")
fi
EMPTY_CATCHES=$(to_int "$EMPTY_CATCHES")

# ── Scan: TODO/FIXME/HACK markers ────────────────────────────────────────
TODO_COUNT=0
if command -v rg &>/dev/null; then
  TODO_COUNT=$(rg_count '\b(TODO|FIXME|HACK|XXX)\b' -g '*.ts' -g '*.tsx' -g '*.go' \
    --glob '!node_modules' --glob '!dist' --glob '!vendor' \
    "$PROJECT_ROOT")
fi
TODO_COUNT=$(to_int "$TODO_COUNT")

# ── Scan: hardcoded localhost/ports ───────────────────────────────────────
HARDCODED_URLS=0
if command -v rg &>/dev/null; then
  HARDCODED_URLS=$(rg_count 'https?://localhost:[0-9]+' -g '*.ts' -g '*.tsx' \
    --glob '!node_modules' --glob '!dist' --glob '!*.test.*' --glob '!*.config.*' \
    --glob '!vite.config*' --glob '!*.md' \
    "$PROJECT_ROOT")
fi
HARDCODED_URLS=$(to_int "$HARDCODED_URLS")

# ── Scan: outdated dependencies ───────────────────────────────────────────
DEPS_OUTDATED=0
if command -v pnpm &>/dev/null && [ -f "$PROJECT_ROOT/package.json" ]; then
  DEPS_OUTDATED=$(cd "$PROJECT_ROOT" && pnpm outdated --no-color 2>/dev/null | grep -c '│' || true)
fi
DEPS_OUTDATED=$(to_int "$DEPS_OUTDATED")

# ── Scan: test coverage ──────────────────────────────────────────────────
TEST_COVERAGE=0
COVERAGE_FILE="$PROJECT_ROOT/coverage/coverage-summary.json"
if [ -f "$COVERAGE_FILE" ] && command -v node &>/dev/null; then
  TEST_COVERAGE=$(node -e "
    try {
      const c = require('$COVERAGE_FILE');
      console.log(Math.round(c.total?.lines?.pct || 0));
    } catch {
      console.log('0');
    }
  " 2>/dev/null || true)
fi
TEST_COVERAGE=$(to_int "$TEST_COVERAGE")

# ── Scan: convention violations (hardcoded hex colors outside theme) ──────
CONVENTIONS=0
if command -v rg &>/dev/null; then
  CONVENTIONS=$(rg -l '#[0-9a-fA-F]{6}' -g '*.ts' -g '*.tsx' \
    --glob '!node_modules' --glob '!dist' --glob '!*.css' --glob '!theme*' --glob '!*.config.*' \
    "$PROJECT_ROOT" 2>/dev/null | wc -l || true)
fi
CONVENTIONS=$(to_int "$CONVENTIONS")

# ── Scan: Go backend vet ──────────────────────────────────────────────────
GO_VET_ISSUES=0
if command -v go &>/dev/null && [ -d "$PROJECT_ROOT/backend/cmd" ]; then
  GO_VET_ISSUES=$(cd "$PROJECT_ROOT/backend" && go vet ./cmd/... 2>&1 | grep -c "^" || true)
fi
GO_VET_ISSUES=$(to_int "$GO_VET_ISSUES")

# ── Compute score ─────────────────────────────────────────────────────────
# Capped deductions prevent any single category from tanking the whole score.
# Max deduction per category: 15 points.
cap() { local v=$1 max=$2; [ "$v" -gt "$max" ] && echo "$max" || echo "$v"; }

D_ANY=$(cap $(( ANY_TYPES / 2 )) 15)
D_LOGS=$(cap "$CONSOLE_LOGS" 15)
D_CATCH=$(cap $(( EMPTY_CATCHES * 3 )) 15)
D_TODO=$(cap $(( TODO_COUNT / 5 )) 10)
D_URLS=$(cap $(( HARDCODED_URLS * 2 )) 15)
D_DEPS=$(cap $(( DEPS_OUTDATED / 3 )) 10)
D_CONV=$(cap $(( CONVENTIONS / 5 )) 10)
D_GOVET=$(cap $(( GO_VET_ISSUES * 3 )) 15)

DEDUCTIONS=$(( D_ANY + D_LOGS + D_CATCH + D_TODO + D_URLS + D_DEPS + D_CONV + D_GOVET ))
BONUS=$(( TEST_COVERAGE * 3 / 10 ))
SCORE=$(( 100 - DEDUCTIONS + BONUS ))
[ "$SCORE" -lt 0 ] && SCORE=0
[ "$SCORE" -gt 100 ] && SCORE=100

# ── Output JSON ───────────────────────────────────────────────────────────
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat <<EOF
{
  "date": "$DATE",
  "score": $SCORE,
  "metrics": {
    "any_types": $ANY_TYPES,
    "console_logs": $CONSOLE_LOGS,
    "empty_catches": $EMPTY_CATCHES,
    "todo_count": $TODO_COUNT,
    "hardcoded_urls": $HARDCODED_URLS,
    "deps_outdated": $DEPS_OUTDATED,
    "test_coverage": $TEST_COVERAGE,
    "conventions": $CONVENTIONS,
    "go_vet_issues": $GO_VET_ISSUES
  },
  "deductions": $DEDUCTIONS,
  "bonus": $BONUS
}
EOF

# ── Optional: POST to API ────────────────────────────────────────────────
if [ "$POST_RESULTS" = true ]; then
  PAYLOAD=$(cat <<EOFP
{
  "date": "$DATE",
  "score": $SCORE,
  "any_types": $ANY_TYPES,
  "console_logs": $CONSOLE_LOGS,
  "empty_catches": $EMPTY_CATCHES,
  "todo_count": $TODO_COUNT,
  "hardcoded_urls": $HARDCODED_URLS,
  "deps_outdated": $DEPS_OUTDATED,
  "test_coverage": $TEST_COVERAGE,
  "conventions": $CONVENTIONS,
  "go_vet_issues": $GO_VET_ISSUES
}
EOFP
)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE/api/health/code" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "Metrics posted to API (HTTP $HTTP_CODE)" >&2
  else
    echo "Warning: API POST returned HTTP $HTTP_CODE" >&2
  fi
fi

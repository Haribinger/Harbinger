#!/usr/bin/env bash
# run-maintenance.sh — Runs all health scans and outputs structured JSON metrics.
#
# Requires: ripgrep (rg), pnpm, jq (optional)
# Usage: bash skills/claude-skills/maintainer/scripts/run-maintenance.sh [--post]

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
API_BASE="${HARBINGER_API:-http://localhost:8080}"
POST_RESULTS=false

for arg in "$@"; do
  case "$arg" in
    --post) POST_RESULTS=true ;;
  esac
done

# ── Scan: any types ──────────────────────────────────────────────────────
ANY_TYPES=0
if command -v rg &>/dev/null; then
  # FIXED: Removed the stray parenthesis
  ANY_TYPES=$(rg -c ': any\b' -g '*.ts' -g '*.tsx' --glob '!node_modules' --glob '!dist' "$PROJECT_ROOT" 2>/dev/null \
    | awk -F: '{s+=$NF} END {print s+0}' | tail -1)
fi
ANY_TYPES=${ANY_TYPES:-0}

# ── Scan: console.log statements ─────────────────────────────────────────
CONSOLE_LOGS=0
if command -v rg &>/dev/null; then
  # FIXED: Changed --type ts to -g patterns
  CONSOLE_LOGS=$(rg -c 'console\.log' -g '*.ts' -g '*.tsx' --glob '!node_modules' --glob '!dist' --glob '!*.test.*' "$PROJECT_ROOT" 2>/dev/null \
    | awk -F: '{s+=$NF} END {print s+0}' | tail -1)
fi
CONSOLE_LOGS=${CONSOLE_LOGS:-0}

# ── Scan: outdated dependencies ───────────────────────────────────────────
DEPS_OUTDATED=0
if command -v pnpm &>/dev/null && [ -f "$PROJECT_ROOT/package.json" ]; then
  # FIXED: Added --no-color flag
  DEPS_OUTDATED=$(cd "$PROJECT_ROOT" && pnpm outdated --no-color 2>/dev/null | grep -c '│' || echo 0)
fi
DEPS_OUTDATED=${DEPS_OUTDATED:-0}

# ── Scan: test coverage ──────────────────────────────────────────────────
TEST_COVERAGE=0
COVERAGE_FILE="$PROJECT_ROOT/coverage/coverage-summary.json"
if [ -f "$COVERAGE_FILE" ]; then
  # FIXED: Added error handling
  TEST_COVERAGE=$(node -e "
    try {
      const c = require('$COVERAGE_FILE');
      console.log(Math.round(c.total?.lines?.pct || 0));
    } catch {
      console.log('0');
    }
  " 2>/dev/null || echo 0)
fi

# ── Scan: convention violations ───────────────────────────────────────────
CONVENTIONS=0
if command -v rg &>/dev/null; then
  # FIXED: Changed --type ts to -g patterns
  CONVENTIONS=$(rg -l '#[0-9a-fA-F]{6}' -g '*.ts' -g '*.tsx' --glob '!node_modules' --glob '!dist' --glob '!*.css' --glob '!theme*' "$PROJECT_ROOT" 2>/dev/null | wc -l || echo 0)
fi
CONVENTIONS=${CONVENTIONS:-0}

# ── Sanitize values ─────────────────────────────────────────────────────
ANY_TYPES=$(echo "$ANY_TYPES" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo 0)
CONSOLE_LOGS=$(echo "$CONSOLE_LOGS" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo 0)
DEPS_OUTDATED=$(echo "$DEPS_OUTDATED" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo 0)
TEST_COVERAGE=$(echo "$TEST_COVERAGE" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo 0)
CONVENTIONS=$(echo "$CONVENTIONS" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo 0)

# ── Compute score ─────────────────────────────────────────────────────────
SCORE=$((100 - ANY_TYPES * 2 - CONSOLE_LOGS - DEPS_OUTDATED * 3 + TEST_COVERAGE))
[ "$SCORE" -lt 0 ] && SCORE=0
[ "$SCORE" -gt 100 ] && SCORE=100

# ── Output JSON ───────────────────────────────────────────────────────────
DATE=$(date -u +%Y-%m-%d)
JSON=$(cat <<EOF
{
  "date": "$DATE",
  "any_types": $ANY_TYPES,
  "console_logs": $CONSOLE_LOGS,
  "test_coverage": $TEST_COVERAGE,
  "deps_outdated": $DEPS_OUTDATED,
  "conventions": $CONVENTIONS,
  "score": $SCORE
}
EOF
)

echo "$JSON"

# ── Optional: POST to API ────────────────────────────────────────────────
if [ "$POST_RESULTS" = true ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE/api/health/code" \
    -H "Content-Type: application/json" \
    -d "$JSON" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "Metrics posted to API (HTTP $HTTP_CODE)"
  else
    echo "Warning: API POST returned HTTP $HTTP_CODE" >&2
  fi
fi

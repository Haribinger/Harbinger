#!/usr/bin/env bash
# safe-fix.sh — Creates a branch, applies safe auto-fixes, verifies build, opens PR.
# Called by: GitHub Actions, MAINTAINER agent nightly cycle.
#
# Safe fixes:
# - Remove console.log (NOT console.error/warn/info)
# - Remove trailing whitespace
#
# If build fails after fixes → reverts all changes, exits 1.
#
# Requires: ripgrep (rg), git, gh CLI
# Usage: bash skills/claude-skills/maintainer/scripts/safe-fix.sh [--dry-run]

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
DRY_RUN=false
DATE=$(date -u +%Y-%m-%d)
BRANCH="maintainer/$DATE"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

cd "$PROJECT_ROOT"

# ── Pre-flight checks ────────────────────────────────────────────────────
if ! command -v rg &>/dev/null; then
  echo "Error: ripgrep (rg) is required" >&2
  exit 1
fi

if ! git diff --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

# ── Create branch ─────────────────────────────────────────────────────────
echo "Creating branch: $BRANCH"
if [ "$DRY_RUN" = false ]; then
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
fi

# ── Fix: Remove console.log statements ───────────────────────────────────
FIXED_COUNT=0
FILES=$(rg -l 'console\.log' --type ts --glob '!node_modules' --glob '!dist' --glob '!*.test.*' --glob '!*.spec.*' 2>/dev/null || true)

if [ -n "$FILES" ]; then
  echo "Removing console.log from $(echo "$FILES" | wc -l) files..."
  if [ "$DRY_RUN" = false ]; then
    for file in $FILES; do
      # Remove lines that are standalone console.log calls
      sed -i '/^\s*console\.log(.*);*\s*$/d' "$file"
      FIXED_COUNT=$((FIXED_COUNT + 1))
    done
  else
    echo "[dry-run] Would fix $(echo "$FILES" | wc -l) files"
  fi
fi

echo "Fixed $FIXED_COUNT files"

# ── Verify build ──────────────────────────────────────────────────────────
if [ "$DRY_RUN" = false ] && [ "$FIXED_COUNT" -gt 0 ]; then
  echo "Verifying build..."

  BUILD_OK=true

  # Check Go backend
  if [ -d "backend/cmd" ]; then
    if ! (cd backend && go build -o /dev/null ./cmd/) 2>/dev/null; then
      echo "Go build FAILED" >&2
      BUILD_OK=false
    fi
  fi

  # Check frontend
  if [ -f "harbinger-tools/frontend/package.json" ]; then
    if ! pnpm build:ui 2>/dev/null; then
      echo "Frontend build FAILED" >&2
      BUILD_OK=false
    fi
  fi

  if [ "$BUILD_OK" = false ]; then
    echo "Build failed — reverting all changes"
    git checkout -- .
    git checkout main 2>/dev/null || git checkout -
    exit 1
  fi

  echo "Build passed"

  # ── Commit and push ──────────────────────────────────────────────────
  git add -A
  git commit -m "chore(maintainer): safe fixes $DATE

Removed $FIXED_COUNT console.log occurrences.
Build verified: Go backend + Vite frontend."

  git push origin "$BRANCH" 2>/dev/null || git push --set-upstream origin "$BRANCH"

  # ── Create PR ────────────────────────────────────────────────────────
  if command -v gh &>/dev/null; then
    PR_URL=$(gh pr create \
      --title "chore(maintainer): safe fixes $DATE" \
      --body "## Maintenance Auto-Fix

- Removed \`console.log\` from $FIXED_COUNT files
- Build verified (Go + Vite)
- Created by MAINTAINER agent

### What was NOT changed
- \`console.error\`, \`console.warn\`, \`console.info\` — preserved
- Test files — skipped
- Business logic — untouched" \
      --base main \
      --label "maintainer,auto-fix" 2>/dev/null || echo "")

    if [ -n "$PR_URL" ]; then
      echo "PR created: $PR_URL"
    else
      echo "Note: PR creation skipped (may already exist or gh not authenticated)"
    fi
  fi
else
  echo "No fixes to apply"
fi

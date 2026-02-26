#!/usr/bin/env bash
# audit-features.sh — Compare codebase state vs documentation
# Usage: bash audit-features.sh

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$ROOT"

echo "=== HARBINGER FEATURE AUDIT ==="
echo ""

# Agent count
AGENT_DIRS=$(ls -1d agents/*/ 2>/dev/null | grep -v "_template" | grep -v "shared" | wc -l)
echo "[Agents] ${AGENT_DIRS} agent profiles found"
ls -1d agents/*/ 2>/dev/null | grep -v "_template" | grep -v "shared" | sed 's|agents/||;s|/||' | while read -r d; do
  SOUL=$(test -f "agents/$d/SOUL.md" && echo "SOUL" || echo "----")
  IDENTITY=$(test -f "agents/$d/IDENTITY.md" && echo "ID" || echo "--")
  SKILLS=$(test -f "agents/$d/SKILLS.md" && echo "SKILLS" || echo "------")
  CONFIG=$(test -f "agents/$d/CONFIG.yaml" && echo "CFG" || echo "---")
  echo "  $d: $SOUL $IDENTITY $SKILLS $CONFIG"
done

echo ""

# Pages
PAGE_COUNT=$(grep -c "lazy(" harbinger-tools/frontend/src/App.tsx 2>/dev/null || echo 0)
echo "[Pages] ${PAGE_COUNT} lazy-loaded pages"
grep "lazy(" harbinger-tools/frontend/src/App.tsx 2>/dev/null | sed "s/.*import('\.\//  /;s/').*//" | sort

echo ""

# Routes
ROUTE_COUNT=$(grep -c "HandleFunc" backend/cmd/main.go 2>/dev/null || echo 0)
echo "[Routes] ${ROUTE_COUNT} registered routes"

echo ""

# Stores
STORE_COUNT=$(ls -1 harbinger-tools/frontend/src/store/*Store.ts 2>/dev/null | wc -l)
echo "[Stores] ${STORE_COUNT} Zustand stores"
ls -1 harbinger-tools/frontend/src/store/*Store.ts 2>/dev/null | sed 's|.*/||;s|\.ts||' | sed 's/^/  /'

echo ""

# Skills
SKILL_COUNT=$(ls -1d skills/claude-skills/*/ 2>/dev/null | grep -v dist | wc -l)
echo "[Skills] ${SKILL_COUNT} skill directories"
ls -1d skills/claude-skills/*/ 2>/dev/null | grep -v dist | sed 's|skills/claude-skills/||;s|/||' | sed 's/^/  /'

echo ""

# Backend files
BACKEND_COUNT=$(ls -1 backend/cmd/*.go 2>/dev/null | wc -l)
echo "[Backend] ${BACKEND_COUNT} Go files in backend/cmd/"
ls -1 backend/cmd/*.go 2>/dev/null | sed 's|.*/||' | sed 's/^/  /'

echo ""

# MCP plugins
MCP_COUNT=$(ls -1d mcp-plugins/*/ 2>/dev/null | wc -l)
echo "[MCP] ${MCP_COUNT} MCP plugin directories"

echo ""

# GitHub workflows
WF_COUNT=$(ls -1 .github/workflows/*.yml 2>/dev/null | wc -l)
echo "[CI/CD] ${WF_COUNT} GitHub Actions workflows"

echo ""

# Documentation check
echo "[Docs] Status:"
for doc in README.md QUICKSTART.md ARCHITECTURE.md CONTRIBUTING.md CHANGELOG.md CLAUDE.md AGENTS.md; do
  if [ -f "$doc" ]; then
    LINES=$(wc -l < "$doc")
    echo "  [OK] $doc ($LINES lines)"
  else
    echo "  [MISSING] $doc"
  fi
done

echo ""
echo "=== AUDIT COMPLETE ==="

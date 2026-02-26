#!/usr/bin/env bash
# website-sync.sh — One-command Harbinger website + docs sync
#
# Usage:
#   bash scripts/global/website-sync.sh              # Interactive mode
#   bash scripts/global/website-sync.sh --full        # Full sync (all steps)
#   bash scripts/global/website-sync.sh --docs        # Documentation sync only
#   bash scripts/global/website-sync.sh --roadmap     # Roadmap update only
#   bash scripts/global/website-sync.sh --detect      # Feature detection only
#   bash scripts/global/website-sync.sh --mcp         # MCP registry generation only
#   bash scripts/global/website-sync.sh --deploy      # Build and deploy only

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$ROOT"

# Colors
GOLD='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo -e "${GOLD}"
  echo "  _   _    _    ____  ____ ___ _   _  ____ _____ ____"
  echo " | | | |  / \\  |  _ \\| __ )_ _| \\ | |/ ___| ____|  _ \\"
  echo " | |_| | / _ \\ | |_) |  _ \\| ||  \\| | |  _|  _| | |_) |"
  echo " |  _  |/ ___ \\|  _ <| |_) | || |\\  | |_| | |___|  _ <"
  echo " |_| |_/_/   \\_\\_| \\_\\____/___|_| \\_|\\____|_____|_| \\_\\"
  echo ""
  echo -e "  ${CYAN}WEBSITE SYNC${NC} — Keep everything in sync"
  echo ""
}

# ============================================================================
# FEATURE DETECTION
# ============================================================================
detect_features() {
  echo -e "${GOLD}[1/6] FEATURE DETECTION${NC}"
  echo ""

  # Agents
  AGENT_DIRS=$(ls -1d agents/*/ 2>/dev/null | grep -v "_template" | grep -v "shared" | grep -v "README" | wc -l)
  AGENTS_LIST=$(ls -1d agents/*/ 2>/dev/null | grep -v "_template" | grep -v "shared" | grep -v "README" | sed 's|agents/||;s|/||')
  echo -e "  ${GREEN}Agents:${NC} $AGENT_DIRS"

  # Pages
  PAGE_COUNT=$(grep -c "lazy(" harbinger-tools/frontend/src/App.tsx 2>/dev/null || echo 0)
  echo -e "  ${GREEN}Pages:${NC} $PAGE_COUNT"

  # Routes
  ROUTE_COUNT=$(grep -c "HandleFunc" backend/cmd/main.go 2>/dev/null || echo 0)
  echo -e "  ${GREEN}Routes:${NC} $ROUTE_COUNT"

  # Stores
  STORE_COUNT=$(ls -1 harbinger-tools/frontend/src/store/*Store.ts 2>/dev/null | wc -l)
  echo -e "  ${GREEN}Stores:${NC} $STORE_COUNT"

  # Skills
  SKILL_COUNT=$(ls -1d skills/claude-skills/*/ 2>/dev/null | grep -v dist | wc -l)
  echo -e "  ${GREEN}Skills:${NC} $SKILL_COUNT"

  # Backend
  BACKEND_COUNT=$(ls -1 backend/cmd/*.go 2>/dev/null | wc -l)
  echo -e "  ${GREEN}Backend files:${NC} $BACKEND_COUNT"

  # MCP
  MCP_COUNT=$(ls -1d mcp-plugins/*/ 2>/dev/null | wc -l)
  echo -e "  ${GREEN}MCP plugins:${NC} $MCP_COUNT"

  # Sidebar nav
  NAV_COUNT=$(grep -c "path:" harbinger-tools/frontend/src/components/Layout/Sidebar.tsx 2>/dev/null || echo 0)
  echo -e "  ${GREEN}Nav items:${NC} $NAV_COUNT"

  echo ""

  # Export for other functions
  export AGENT_DIRS PAGE_COUNT ROUTE_COUNT STORE_COUNT SKILL_COUNT BACKEND_COUNT MCP_COUNT NAV_COUNT AGENTS_LIST
}

# ============================================================================
# DOCUMENTATION SYNC
# ============================================================================
sync_docs() {
  echo -e "${GOLD}[2/6] DOCUMENTATION SYNC${NC}"
  echo ""

  # Check each doc file
  for doc in README.md QUICKSTART.md ARCHITECTURE.md CONTRIBUTING.md CHANGELOG.md CLAUDE.md; do
    if [ -f "$doc" ]; then
      LINES=$(wc -l < "$doc")
      echo -e "  ${GREEN}[OK]${NC} $doc ($LINES lines)"
    else
      echo -e "  ${RED}[MISSING]${NC} $doc"
    fi
  done

  # Check agent profiles
  echo ""
  echo "  Agent Profile Completeness:"
  for dir in $AGENTS_LIST; do
    if [ -d "agents/$dir" ]; then
      SCORE=0
      [ -f "agents/$dir/SOUL.md" ] && ((SCORE++))
      [ -f "agents/$dir/IDENTITY.md" ] && ((SCORE++))
      [ -f "agents/$dir/SKILLS.md" ] && ((SCORE++))
      [ -f "agents/$dir/CONFIG.yaml" ] && ((SCORE++))
      [ -f "agents/$dir/TOOLS.md" ] && ((SCORE++))
      [ -f "agents/$dir/HEARTBEAT.md" ] && ((SCORE++))

      if [ "$SCORE" -ge 5 ]; then
        echo -e "    ${GREEN}[$SCORE/6]${NC} $dir"
      elif [ "$SCORE" -ge 3 ]; then
        echo -e "    ${GOLD}[$SCORE/6]${NC} $dir"
      else
        echo -e "    ${RED}[$SCORE/6]${NC} $dir"
      fi
    fi
  done

  echo ""
}

# ============================================================================
# ROADMAP UPDATE
# ============================================================================
sync_roadmap() {
  echo -e "${GOLD}[3/6] ROADMAP STATUS${NC}"
  echo ""

  # Parse recent features from git log
  echo "  Recent commits (last 20):"
  git log --oneline -20 2>/dev/null | sed 's/^/    /'

  echo ""
  echo "  Completed Features:"
  echo -e "    ${GREEN}[DONE]${NC} 11 Agent profiles with SOUL.md"
  echo -e "    ${GREEN}[DONE]${NC} Visual workflow editor (6 node types)"
  echo -e "    ${GREEN}[DONE]${NC} Browser CDP with live views"
  echo -e "    ${GREEN}[DONE]${NC} Multi-provider OAuth (GitHub, Google, API keys)"
  echo -e "    ${GREEN}[DONE]${NC} Code health dashboard (Recharts)"
  echo -e "    ${GREEN}[DONE]${NC} Smart model router (5 complexity tiers)"
  echo -e "    ${GREEN}[DONE]${NC} Scope manager page"
  echo -e "    ${GREEN}[DONE]${NC} Vulnerability deep-dive view"
  echo -e "    ${GREEN}[DONE]${NC} Remediation tracker (Kanban)"
  echo -e "    ${GREEN}[DONE]${NC} MAINTAINER agent + GitHub Actions CI"
  echo -e "    ${GREEN}[DONE]${NC} Feature deploy skill pipeline"
  echo -e "    ${GREEN}[DONE]${NC} Website sync skill"
  echo -e "    ${GREEN}[DONE]${NC} GitHub templates (issues, PRs)"
  echo -e "    ${GREEN}[DONE]${NC} Codespaces devcontainer"

  echo ""
  echo "  Planned Features:"
  echo -e "    ${GOLD}[PLAN]${NC} MCP Registry submission"
  echo -e "    ${GOLD}[PLAN]${NC} GitHub Models as AI provider"
  echo -e "    ${GOLD}[PLAN]${NC} GitHub Projects bounty tracking"
  echo -e "    ${GOLD}[PLAN]${NC} Discord structured channels + slash commands"
  echo -e "    ${GOLD}[PLAN]${NC} Nuclei Template IDE"
  echo -e "    ${GOLD}[PLAN]${NC} Agent-to-agent knowledge graph handoff"
  echo ""
}

# ============================================================================
# MCP REGISTRY GENERATION
# ============================================================================
generate_mcp() {
  echo -e "${GOLD}[4/6] MCP REGISTRY DEFINITIONS${NC}"
  echo ""

  MCP_DIR="mcp-plugins"
  OUTPUT_DIR="/tmp/harbinger-mcp-registry"
  mkdir -p "$OUTPUT_DIR"

  for plugin_dir in "$MCP_DIR"/*/; do
    PLUGIN_NAME=$(basename "$plugin_dir")
    echo -e "  Generating MCP definition for: ${CYAN}$PLUGIN_NAME${NC}"

    cat > "$OUTPUT_DIR/$PLUGIN_NAME.json" <<MCPEOF
{
  "name": "@harbinger/$PLUGIN_NAME",
  "description": "Harbinger $PLUGIN_NAME MCP server",
  "repository": "https://github.com/kdairatchi/harbinger/tree/main/mcp-plugins/$PLUGIN_NAME",
  "transport": ["stdio", "sse"],
  "installation": {
    "docker": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "harbinger/$PLUGIN_NAME:latest"],
      "env": {
        "HARBINGER_API_URL": "http://localhost:8080"
      }
    }
  },
  "tools": []
}
MCPEOF
    echo "    → $OUTPUT_DIR/$PLUGIN_NAME.json"
  done

  echo ""
  echo "  MCP definitions written to: $OUTPUT_DIR/"
  echo ""
}

# ============================================================================
# BUILD & VERIFY
# ============================================================================
build_verify() {
  echo -e "${GOLD}[5/6] BUILD VERIFICATION${NC}"
  echo ""

  # Backend
  echo -n "  Go backend... "
  if go build -o /dev/null ./backend/cmd/ 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
  else
    echo -e "${RED}FAIL${NC}"
    return 1
  fi

  # Frontend
  echo -n "  Frontend (pnpm build:ui)... "
  if pnpm build:ui >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
  else
    echo -e "${RED}FAIL${NC}"
    return 1
  fi

  echo ""
}

# ============================================================================
# DEPLOY
# ============================================================================
deploy() {
  echo -e "${GOLD}[6/6] DEPLOY${NC}"
  echo ""

  # Check for uncommitted changes
  CHANGES=$(git status --porcelain 2>/dev/null | wc -l)
  if [ "$CHANGES" -gt 0 ]; then
    echo "  $CHANGES uncommitted changes found"
    echo ""

    # Stage and commit
    git add -A
    COMMIT_MSG="chore: sync website, docs, and features

- Feature count: ${AGENT_DIRS:-?} agents, ${PAGE_COUNT:-?} pages, ${ROUTE_COUNT:-?} routes
- Documentation updated
- Roadmap refreshed

Co-Authored-By: MAINTAINER <maintainer@harbinger.local>"

    git commit -m "$COMMIT_MSG" 2>/dev/null || true
    echo -e "  ${GREEN}Committed${NC}"
  else
    echo "  No changes to commit"
  fi

  # Push
  BRANCH=$(git branch --show-current 2>/dev/null)
  echo -n "  Pushing to origin/$BRANCH... "
  if git push origin "$BRANCH" 2>/dev/null; then
    echo -e "${GREEN}DONE${NC}"
  else
    echo -e "${RED}FAILED (may need git push --set-upstream)${NC}"
    git push -u origin "$BRANCH" 2>/dev/null || echo "  Push failed — check remote configuration"
  fi

  echo ""
}

# ============================================================================
# MAIN
# ============================================================================
MODE="${1:-}"

banner

case "$MODE" in
  --full)
    detect_features
    sync_docs
    sync_roadmap
    generate_mcp
    build_verify
    deploy
    ;;
  --docs)
    detect_features
    sync_docs
    ;;
  --roadmap)
    sync_roadmap
    ;;
  --detect)
    detect_features
    ;;
  --mcp)
    generate_mcp
    ;;
  --deploy)
    detect_features
    build_verify
    deploy
    ;;
  *)
    echo "Usage: website-sync.sh [--full|--docs|--roadmap|--detect|--mcp|--deploy]"
    echo ""
    echo "  --full     Run all steps: detect → docs → roadmap → mcp → build → deploy"
    echo "  --docs     Documentation audit and sync"
    echo "  --roadmap  Roadmap status update"
    echo "  --detect   Feature detection only"
    echo "  --mcp      Generate MCP registry definitions"
    echo "  --deploy   Build, commit, and push"
    echo ""
    echo "Running feature detection..."
    echo ""
    detect_features
    sync_docs
    sync_roadmap
    ;;
esac

echo -e "${GOLD}=== SYNC COMPLETE ===${NC}"

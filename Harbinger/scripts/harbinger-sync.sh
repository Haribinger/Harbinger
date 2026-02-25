#!/usr/bin/env bash
# Harbinger Sync Script
# Prevents merge conflicts between local development and remote pushes
# Usage: ./scripts/harbinger-sync.sh [push|pull|status]

set -euo pipefail

CYAN=\'\033[0;36m\'
GREEN=\'\033[0;32m\'
RED=\'\033[0;31m\'
YELLOW=\'\033[1;33m\'
NC=\'\033[0m\'

banner() {
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════╗"
  echo "║     HARBINGER SYNC TOOL v1.0         ║"
  echo "║     Never bump heads again.          ║"
  echo "╚══════════════════════════════════════╝"
  echo -e "${NC}"
}

sync_pull() {
  echo -e "${YELLOW}[SYNC] Fetching remote changes...${NC}"
  git fetch origin
  
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main)
  
  if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}[SYNC] Already up to date.${NC}"
    return 0
  fi
  
  echo -e "${YELLOW}[SYNC] Remote has new commits. Pulling with rebase...${NC}"
  git stash --include-untracked -m "harbinger-sync-autostash" 2>/dev/null || true
  
  if git pull --rebase origin main; then
    echo -e "${GREEN}[SYNC] Pull successful.${NC}"
  else
    echo -e "${RED}[SYNC] Rebase conflict detected. Attempting merge instead...${NC}"
    git rebase --abort 2>/dev/null || true
    git pull origin main --allow-unrelated-histories
  fi
  
  # Restore stashed changes
  if git stash list | grep -q "harbinger-sync-autostash"; then
    echo -e "${YELLOW}[SYNC] Restoring your local changes...${NC}"
    git stash pop || echo -e "${RED}[SYNC] Stash pop had conflicts. Run \'git stash show -p\' to see changes.${NC}"
  fi
  
  echo -e "${GREEN}[SYNC] Done. You\'re up to date.${NC}"
}

sync_push() {
  echo -e "${YELLOW}[SYNC] Preparing to push...${NC}"
  
  # First pull to avoid conflicts
  sync_pull
  
  # Check for uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}[SYNC] You have uncommitted changes. Committing...${NC}"
    git add -A
    read -p "Commit message (or press Enter for auto): " msg
    if [ -z "$msg" ]; then
      msg="sync: local changes $(date +%Y-%m-%d_%H:%M)"
    fi
    git commit -m "$msg"
  fi
  
  if git push origin main; then
    echo -e "${GREEN}[SYNC] Push successful!${NC}"
  else
    echo -e "${YELLOW}[SYNC] Push failed. Trying force-with-lease...${NC}"
    git push origin main --force-with-lease
  fi
  
  echo -e "${GREEN}[SYNC] Done. Remote is updated.${NC}"
}

sync_status() {
  echo -e "${YELLOW}[SYNC] Checking status...${NC}"
  git fetch origin 2>/dev/null
  
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
  BASE=$(git merge-base HEAD origin/main 2>/dev/null || echo "unknown")
  
  echo -e "${CYAN}Local:  ${LOCAL:0:8}${NC}"
  echo -e "${CYAN}Remote: ${REMOTE:0:8}${NC}"
  
  if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}Status: In sync ✓${NC}"
  elif [ "$LOCAL" = "$BASE" ]; then
    echo -e "${YELLOW}Status: Behind remote (pull needed)${NC}"
  elif [ "$REMOTE" = "$BASE" ]; then
    echo -e "${YELLOW}Status: Ahead of remote (push needed)${NC}"
  else
    echo -e "${RED}Status: Diverged (sync needed)${NC}"
  fi
  
  echo ""
  echo -e "${CYAN}Uncommitted changes:${NC}"
  git status --short
}

banner

case "${1:-status}" in
  pull)  sync_pull ;;
  push)  sync_push ;;
  status) sync_status ;;
  *)
    echo "Usage: $0 [pull|push|status]"
    echo "  pull   - Safely pull remote changes"
    echo "  push   - Sync and push your changes"  
    echo "  status - Check sync status"
    ;;
esac

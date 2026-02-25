#!/usr/bin/env bash
# Build all Harbinger Go security tools
set -euo pipefail

CYAN=\'\033[0;36m\'
GREEN=\'\033[0;32m\'
RED=\'\033[0;31m\'
NC=\'\033[0m\'

TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$TOOLS_DIR/../../bin"
mkdir -p "$BIN_DIR"

echo -e "${CYAN}[HARBINGER] Building Go security tools...${NC}"

declare -A REPOS=(
  ["shef"]="1hehaq/shef"
  ["recx"]="1hehaq/recx"
  ["roq"]="1hehaq/roq"
  ["ceye"]="1hehaq/ceye"
  ["faviqon"]="1hehaq/faviqon"
  ["ppmap"]="1hehaq/ppmap"
  ["pdsi"]="1hehaq/pdsi"
  ["dorq"]="1hehaq/dorq"
  ["xssmap"]="1hehaq/xssmap"
)

for tool in "${!REPOS[@]}"; do
  repo="${REPOS[$tool]}"
  echo -e "${CYAN}[BUILD] $tool from $repo${NC}"
  
  if [ -d "$TOOLS_DIR/src/$tool" ]; then
    cd "$TOOLS_DIR/src/$tool"
    git pull --quiet 2>/dev/null || true
  else
    mkdir -p "$TOOLS_DIR/src"
    git clone --quiet "https://github.com/$repo.git" "$TOOLS_DIR/src/$tool" 2>/dev/null || {
      echo -e "${RED}[SKIP] Failed to clone $repo${NC}"
      continue
    }
    cd "$TOOLS_DIR/src/$tool"
  fi
  
  if go build -o "$BIN_DIR/$tool" ./... 2>/dev/null; then
    echo -e "${GREEN}[OK] $tool built → $BIN_DIR/$tool${NC}"
  else
    echo -e "${RED}[FAIL] $tool build failed${NC}"
  fi
  
  cd "$TOOLS_DIR"
done

echo ""
echo -e "${GREEN}[HARBINGER] Build complete. Tools in $BIN_DIR/${NC}"
ls -la "$BIN_DIR/"

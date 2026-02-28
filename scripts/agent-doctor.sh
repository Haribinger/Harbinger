#!/usr/bin/env bash
# scripts/agent-doctor.sh — Harbinger agent & infrastructure health checker
# Verifies agent definitions, API endpoints, Docker config, and build integrity.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

pass()  { PASS=$((PASS+1)); echo -e "  ${GREEN}[PASS]${NC} $1"; }
warn()  { WARN=$((WARN+1)); echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail()  { FAIL=$((FAIL+1)); echo -e "  ${RED}[FAIL]${NC} $1"; }
info()  { echo -e "  ${CYAN}[INFO]${NC} $1"; }
header(){ echo -e "\n${BOLD}$1${NC}"; }

# Resolve repo root (works from any subdirectory)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${BOLD}Harbinger Agent Doctor${NC}"
echo "Repo: $REPO_ROOT"
echo ""

# ── 1. Agent Profile Directories ──────────────────────────────────────────
header "1. Agent Profile Directories"

EXPECTED_AGENTS=(
  "recon-scout"
  "web-hacker"
  "cloud-infiltrator"
  "osint-detective"
  "binary-reverser"
  "report-writer"
  "coding-assistant"
  "morning-brief"
  "learning-agent"
  "browser-agent"
  "maintainer"
)

AGENT_DIR_COUNT=0
for agent in "${EXPECTED_AGENTS[@]}"; do
  dir="agents/$agent"
  if [ -d "$dir" ]; then
    AGENT_DIR_COUNT=$((AGENT_DIR_COUNT+1))
    if [ -f "$dir/SOUL.md" ]; then
      pass "$agent/ + SOUL.md"
    else
      warn "$agent/ exists but missing SOUL.md"
    fi
  else
    fail "$agent/ directory missing"
  fi
done
info "Found $AGENT_DIR_COUNT / ${#EXPECTED_AGENTS[@]} agent directories"

# ── 2. Backend Agent Handlers ─────────────────────────────────────────────
header "2. Backend Agent API"

BACKEND_CMD="backend/cmd"
if [ -f "$BACKEND_CMD/agents.go" ]; then
  HANDLER_COUNT=$(grep -c 'func handle.*Agent' "$BACKEND_CMD/agents.go" 2>/dev/null || echo "0")
  pass "agents.go exists ($HANDLER_COUNT handler functions)"

  # Check agent type mapping
  TYPE_MAP_COUNT=$(grep -c '"[a-z-]*":' "$BACKEND_CMD/agents.go" 2>/dev/null | head -1 || echo "0")
  if [ "$TYPE_MAP_COUNT" -ge 10 ]; then
    pass "Agent type-to-dir mapping has $TYPE_MAP_COUNT entries"
  else
    warn "Agent type-to-dir mapping has only $TYPE_MAP_COUNT entries"
  fi
else
  fail "agents.go not found"
fi

# Check backend compiles
if [ -f "$BACKEND_CMD/main.go" ]; then
  if command -v go &>/dev/null; then
    if (cd backend && go build -o /dev/null ./cmd/ 2>/dev/null); then
      pass "Backend compiles"
    else
      fail "Backend build failed"
    fi
  else
    warn "Go not installed, skipping build check"
  fi
fi

# ── 3. Frontend Agent Infrastructure ──────────────────────────────────────
header "3. Frontend Agent Infrastructure"

FE_SRC="harbinger-tools/frontend/src"

# Agent store
if [ -f "$FE_SRC/store/agentStore.ts" ]; then
  pass "agentStore.ts exists"
else
  fail "agentStore.ts missing"
fi

# Agent API module
if [ -f "$FE_SRC/api/agents.ts" ]; then
  pass "api/agents.ts exists"
else
  fail "api/agents.ts missing"
fi

# Agent types
if [ -f "$FE_SRC/types/index.ts" ]; then
  if grep -q "Agent" "$FE_SRC/types/index.ts" 2>/dev/null; then
    pass "Agent type definitions found"
  else
    warn "types/index.ts exists but no Agent interface"
  fi
else
  fail "types/index.ts missing"
fi

# Agent-related pages
AGENT_PAGES=("Agents" "CommandCenter" "Autonomous")
for page in "${AGENT_PAGES[@]}"; do
  if ls "$FE_SRC/pages/$page"* 2>/dev/null | head -1 &>/dev/null; then
    pass "Page: $page"
  else
    warn "Page not found: $page"
  fi
done

# Routes check
if [ -f "$FE_SRC/App.tsx" ]; then
  if grep -q "agents" "$FE_SRC/App.tsx" 2>/dev/null; then
    pass "Agent routes configured in App.tsx"
  else
    warn "No agent route found in App.tsx"
  fi
fi

# ── 4. Docker Configuration ──────────────────────────────────────────────
header "4. Docker Configuration"

if [ -f "docker-compose.yml" ]; then
  pass "docker-compose.yml exists"

  # Check for required env var enforcement
  REQUIRED_COUNT=$(grep -c ':?' docker-compose.yml 2>/dev/null || echo "0")
  if [ "$REQUIRED_COUNT" -ge 4 ]; then
    pass "Required env vars enforced ($REQUIRED_COUNT variables)"
  else
    warn "Only $REQUIRED_COUNT required env vars — secrets may have unsafe defaults"
  fi

  # Check no database ports exposed
  if grep -q '"5432:5432"' docker-compose.yml 2>/dev/null; then
    fail "PostgreSQL port exposed to host"
  else
    pass "PostgreSQL port not exposed"
  fi

  if grep -q '"6379:6379"' docker-compose.yml 2>/dev/null; then
    fail "Redis port exposed to host"
  else
    pass "Redis port not exposed"
  fi

  # Check Docker socket proxy
  if grep -q 'docker-proxy' docker-compose.yml 2>/dev/null; then
    pass "Docker socket proxy configured"
  else
    warn "Raw Docker socket mount — use docker-socket-proxy in production"
  fi

  # Resource limits
  LIMIT_COUNT=$(grep -c 'memory:' docker-compose.yml 2>/dev/null || echo "0")
  if [ "$LIMIT_COUNT" -ge 5 ]; then
    pass "Resource limits set ($LIMIT_COUNT memory constraints)"
  else
    warn "Only $LIMIT_COUNT memory limits — add deploy.resources to all services"
  fi

  # Healthchecks
  HC_COUNT=$(grep -c 'healthcheck:' docker-compose.yml 2>/dev/null || echo "0")
  if [ "$HC_COUNT" -ge 5 ]; then
    pass "Healthchecks present ($HC_COUNT services)"
  else
    warn "Only $HC_COUNT healthchecks — add to all services"
  fi

  # Log rotation
  LOG_COUNT=$(grep -c 'max-size:' docker-compose.yml 2>/dev/null || echo "0")
  if [ "$LOG_COUNT" -ge 5 ]; then
    pass "Log rotation configured ($LOG_COUNT services)"
  else
    warn "Log rotation missing on some services"
  fi
else
  fail "docker-compose.yml missing"
fi

# Dockerfile checks
header "5. Dockerfiles"

DOCKERFILES=(
  "backend/Dockerfile"
  "harbinger-tools/frontend/Dockerfile"
  "mcp-plugins/hexstrike-ai/Dockerfile"
  "mcp-plugins/pentagi/Dockerfile"
  "mcp-plugins/redteam/Dockerfile"
  "mcp-plugins/mcp-ui/Dockerfile"
)

for df in "${DOCKERFILES[@]}"; do
  if [ -f "$df" ]; then
    # Non-root check
    if grep -q 'USER ' "$df" 2>/dev/null; then
      pass "$df — non-root user"
    else
      fail "$df — running as root"
    fi

    # Error suppression check
    if grep -q '|| true' "$df" 2>/dev/null; then
      warn "$df — contains '|| true' (hides build errors)"
    fi

    if grep -q '2>/dev/null' "$df" 2>/dev/null; then
      warn "$df — suppresses stderr"
    fi
  else
    fail "$df not found"
  fi
done

# ── 6. Security Checks ───────────────────────────────────────────────────
header "6. Security"

# .env not tracked
if git ls-files --error-unmatch .env &>/dev/null 2>&1; then
  fail ".env is tracked by git"
else
  pass ".env is not tracked by git"
fi

# .dockerignore blocks .env
if [ -f ".dockerignore" ]; then
  if grep -q '^\.env$\|^\.env\b' ".dockerignore" 2>/dev/null; then
    pass ".dockerignore excludes .env"
  else
    fail ".dockerignore does NOT exclude .env"
  fi
fi

# No hardcoded admin password in SQL
if [ -f "docker/postgres/init.sql" ]; then
  if grep -qi 'password.*change-me\|INSERT INTO users.*admin' "docker/postgres/init.sql" 2>/dev/null; then
    fail "Hardcoded admin credentials in init.sql"
  else
    pass "No hardcoded admin credentials"
  fi
fi

# nginx security headers
if [ -f "docker/nginx/nginx.conf" ]; then
  if grep -q 'Content-Security-Policy' "docker/nginx/nginx.conf" 2>/dev/null; then
    pass "CSP header present in nginx"
  else
    warn "No Content-Security-Policy header"
  fi

  if grep -q 'limit_req_zone' "docker/nginx/nginx.conf" 2>/dev/null; then
    pass "Rate limiting configured in nginx"
  else
    warn "No rate limiting in nginx"
  fi
fi

# ── 7. CI/CD Workflows ───────────────────────────────────────────────────
header "7. CI/CD Workflows"

WORKFLOWS=(
  ".github/workflows/ci.yml"
  ".github/workflows/pr-health.yml"
  ".github/workflows/maintainer-schedule.yml"
  ".github/workflows/community-welcome.yml"
)

for wf in "${WORKFLOWS[@]}"; do
  if [ -f "$wf" ]; then
    pass "$(basename "$wf")"
  else
    warn "$(basename "$wf") missing"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${YELLOW}WARN${NC}: $WARN"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo ""

TOTAL=$((PASS+WARN+FAIL))
if [ "$TOTAL" -gt 0 ]; then
  SCORE=$(( (PASS * 100) / TOTAL ))
else
  SCORE=0
fi

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}Health Score: ${SCORE}% — All checks passed${NC}"
  exit 0
elif [ "$FAIL" -le 2 ]; then
  echo -e "${YELLOW}Health Score: ${SCORE}% — Minor issues${NC}"
  exit 0
else
  echo -e "${RED}Health Score: ${SCORE}% — Critical issues need attention${NC}"
  exit 1
fi

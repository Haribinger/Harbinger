#!/usr/bin/env bash
# ============================================================================
# OpenClaw + Harbinger Integration Installer
# Installs Harbinger skills into OpenClaw and configures multi-agent routing
# ============================================================================

set -euo pipefail

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

HARBINGER_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
SKILLS_DIR="$OPENCLAW_DIR/skills/harbinger"
AGENTS_DIR="$OPENCLAW_DIR/agents"
HARBINGER_API="${HARBINGER_API:-http://localhost:8080}"

banner() {
  echo -e "${YELLOW}"
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║     OPENCLAW + HARBINGER INTEGRATION INSTALLER      ║"
  echo "  ║     Voice-Controlled Mission Control Setup           ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

log()   { echo -e "  ${GREEN}[+]${NC} $1"; }
warn()  { echo -e "  ${YELLOW}[!]${NC} $1"; }
err()   { echo -e "  ${RED}[x]${NC} $1"; }
info()  { echo -e "  ${CYAN}[*]${NC} $1"; }

check_openclaw() {
  info "Checking OpenClaw installation..."
  if command -v openclaw &>/dev/null; then
    local ver
    ver=$(openclaw --version 2>/dev/null || echo "unknown")
    log "OpenClaw found: $ver"
    return 0
  fi

  warn "OpenClaw not found in PATH"
  echo ""
  echo -e "  Install OpenClaw first:"
  echo -e "    ${BOLD}curl -fsSL https://get.openclaw.ai | sh${NC}"
  echo -e "    ${BOLD}npm install -g openclaw${NC}"
  echo ""
  read -p "  Continue without OpenClaw? (skills will still be copied) [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
}

check_harbinger() {
  info "Checking Harbinger backend..."
  if curl -sf "$HARBINGER_API/health" >/dev/null 2>&1; then
    log "Harbinger API reachable at $HARBINGER_API"
  else
    warn "Harbinger API not reachable at $HARBINGER_API"
    warn "Make sure to run: docker-compose up -d (or cd backend && go run ./cmd/)"
  fi
}

install_skills() {
  info "Installing Harbinger skills..."
  mkdir -p "$SKILLS_DIR"

  local skill_src="$HARBINGER_ROOT/openclaw/skills"
  if [[ ! -d "$skill_src" ]]; then
    err "Skills directory not found at $skill_src"
    return 1
  fi

  local count=0
  for skill in "$skill_src"/*.skill; do
    [[ -f "$skill" ]] || continue
    local name
    name=$(basename "$skill")
    cp "$skill" "$SKILLS_DIR/$name"
    log "Installed skill: $name"
    count=$((count + 1))
  done

  log "Installed $count Harbinger skills to $SKILLS_DIR"
}

configure_agents() {
  info "Configuring OpenClaw multi-agent routing..."
  mkdir -p "$AGENTS_DIR"

  # Create the Harbinger Commander agent workspace
  local cmd_dir="$AGENTS_DIR/harbinger-commander"
  mkdir -p "$cmd_dir"

  cat > "$cmd_dir/AGENTS.md" << 'AGENTEOF'
# Harbinger Commander

You are the Harbinger Mission Commander. You control a dynamic swarm of autonomous security agents.

## Dynamic Agent Discovery
Do NOT assume a fixed set of agents. Always query the Harbinger API to discover available agents:

```
GET http://localhost:8080/api/agents
```

This returns ALL registered agents — including custom user-created agents, clones, and templates.

## How You Work
1. Listen to the user's command
2. Query /api/agents to discover available agents
3. Match the best agent(s) for the task by type/capabilities
4. Call POST /api/agents/{id}/spawn to deploy
5. Monitor progress via /api/agents/{id}/status and /api/agents/{id}/logs
6. Report findings back to the user
7. Chain agents when needed (recon → exploit → report)

## API Base
http://localhost:8080/api

## Key Endpoints
- GET /api/agents — list all agents (dynamic, any number)
- GET /api/agents/templates — available agent templates
- POST /api/agents — create new agent
- POST /api/agents/{id}/spawn — start agent container
- POST /api/agents/{id}/stop — stop agent container
- POST /api/agents/{id}/clone — clone an existing agent
- GET /api/agents/{id}/logs — get container logs

## Rules
- Always confirm before running destructive operations
- Show the user what's happening at each step
- Use the Harbinger frontend for visualization: http://localhost:5173
- Report findings with severity levels (critical/high/medium/low/info)
- NEVER hardcode agent names — always discover dynamically via API
AGENTEOF

  cat > "$cmd_dir/SOUL.md" << 'SOULEOF'
You speak like a military operations commander. Brief, clear, decisive.
Use codenames for agents. Report status using military-style terminology.
When findings are critical, escalate immediately.
Always maintain operational security awareness.
SOULEOF

  log "Created Harbinger Commander agent workspace"

  # Dynamically discover agents from the API (if running)
  local agent_count=0
  if curl -sf "$HARBINGER_API/api/agents" >/dev/null 2>&1; then
    info "Discovering agents from Harbinger API..."
    local agents_json
    agents_json=$(curl -sf "$HARBINGER_API/api/agents" 2>/dev/null || echo "[]")

    # Parse each agent and create a workspace
    # Uses jq if available, falls back to defaults
    if command -v jq &>/dev/null; then
      local count
      count=$(echo "$agents_json" | jq 'if type == "array" then length else 0 end' 2>/dev/null || echo "0")
      for i in $(seq 0 $((count - 1))); do
        local agent_name agent_type agent_id
        agent_name=$(echo "$agents_json" | jq -r ".[$i].name" 2>/dev/null)
        agent_type=$(echo "$agents_json" | jq -r ".[$i].type" 2>/dev/null)
        agent_id=$(echo "$agents_json" | jq -r ".[$i].id" 2>/dev/null)
        local safe_name
        safe_name=$(echo "$agent_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
        local agent_dir="$AGENTS_DIR/harbinger-$safe_name"
        mkdir -p "$agent_dir"
        cat > "$agent_dir/AGENTS.md" << EOF
# ${agent_name}

You are ${agent_name}, a specialized security agent in the Harbinger swarm.
Your type: ${agent_type}
Your ID: ${agent_id}
Your API: ${HARBINGER_API}/api/agents/${agent_id}

Follow your skill instructions precisely. Report findings in structured format.
Query your own status: GET ${HARBINGER_API}/api/agents/${agent_id}/status
EOF
        log "Created agent workspace: harbinger-$safe_name (from API)"
        agent_count=$((agent_count + 1))
      done
    fi
  fi

  # If API discovery found nothing, create workspaces for default seed agents
  if [ "$agent_count" -eq 0 ]; then
    warn "API not available or no agents found — creating default agent workspaces"
    local agent_types=("pathfinder:recon" "breach:web" "phantom:cloud" "specter:osint" "cipher:binary" "scribe:report")
    for entry in "${agent_types[@]}"; do
      local name="${entry%%:*}"
      local type="${entry##*:}"
      local agent_dir="$AGENTS_DIR/harbinger-$name"
      mkdir -p "$agent_dir"
      cat > "$agent_dir/AGENTS.md" << EOF
# ${name^^}

You are ${name^^}, a specialized security agent in the Harbinger swarm.
Your type: $type
Your API: ${HARBINGER_API}/api/agents (find yourself by name "${name^^}")

Follow your skill instructions precisely. Report findings in structured format.
NOTE: This is a default workspace. For dynamic discovery, ensure Harbinger API is running.
EOF
      log "Created default agent workspace: harbinger-$name"
      agent_count=$((agent_count + 1))
    done
  fi

  log "Configured $agent_count agent workspaces"
}

configure_webhook() {
  info "Setting up Harbinger webhook channel..."

  local webhook_config="$OPENCLAW_DIR/channels/harbinger-webhook.json"
  mkdir -p "$(dirname "$webhook_config")"

  cat > "$webhook_config" << EOF
{
  "type": "webhook",
  "id": "harbinger",
  "name": "Harbinger Events",
  "url": "${HARBINGER_API}/api/openclaw/webhook",
  "secret": "$(openssl rand -hex 32)",
  "events": [
    "agent.spawned",
    "agent.stopped",
    "job.completed",
    "finding.critical",
    "workflow.finished"
  ]
}
EOF

  log "Webhook channel configured at $webhook_config"
}

print_summary() {
  echo ""
  echo -e "${GREEN}  ════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Installation Complete${NC}"
  echo -e "${GREEN}  ════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Skills:${NC}     $SKILLS_DIR/"
  echo -e "  ${BOLD}Agents:${NC}     $AGENTS_DIR/harbinger-*"
  echo -e "  ${BOLD}API:${NC}        $HARBINGER_API"
  echo -e "  ${BOLD}Frontend:${NC}   http://localhost:5173/openclaw"
  echo ""
  echo -e "  ${BOLD}Next steps:${NC}"
  echo -e "    1. Start Harbinger:  ${CYAN}docker-compose up -d${NC}"
  echo -e "    2. Start OpenClaw:   ${CYAN}openclaw gateway start${NC}"
  echo -e "    3. Open mission ctrl: ${CYAN}http://localhost:5173/openclaw${NC}"
  echo ""
  echo -e "  ${BOLD}Quick test:${NC}"
  echo -e "    ${CYAN}openclaw chat \"Show me my Harbinger agents\"${NC}"
  echo ""
  echo -e "${YELLOW}  The lobster commands the swarm.${NC}"
  echo ""
}

# Main
banner
check_openclaw
check_harbinger
install_skills
configure_agents
configure_webhook
print_summary

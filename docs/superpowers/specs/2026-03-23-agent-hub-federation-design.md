# Agent Hub — External Agent Federation via ROAR Protocol

**Date:** 2026-03-23
**Status:** Design Complete — Awaiting Implementation Plan
**Scope:** Replace OpenClaw with Agent Hub — a unified control surface for built-in agents, external autonomous agents (ROAR federation), and MCP tool providers.

---

## 1. Problem

OpenClaw is underutilized — it's a basic voice/chat command gateway with minimal functionality. Meanwhile, the broader autonomous agent ecosystem (PentAGI, AgentZero, ThePopeBot, NanoClaw, CoPaw, etc.) has no integration path into Harbinger's mission system. Each external agent would need custom wiring.

Harbinger already has ROAR protocol fully implemented (`backend/pkg/roar/` — 7 files, DID identity, pub-sub messaging, capability-based discovery) and a Python agent registry that supports `register()` for custom agents. These pieces just need connecting.

## 2. Solution

**Agent Hub** replaces OpenClaw at `/agent-hub`. It provides:

1. **Curated Catalog** — browse and one-click install known external agents
2. **Manual Registration** — paste a Docker image or ROAR endpoint URL for any agent
3. **ROAR Federation** — external agents communicate via the existing ROAR bus
4. **MCP Bridge** — tool-only integrations (no ROAR needed) get bridged automatically
5. **Trust Scoring** — capability-matched delegation with trust tiers and performance tracking
6. **Unified View** — single page to manage all agents (built-in + external + MCP tools)

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        AGENT HUB                             │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │
│  │ Catalog  │  │  Active  │  │  Feed    │  │  Settings  │   │
│  │ Browse   │  │  ROAR    │  │ Inter-   │  │  Trust     │   │
│  │ Install  │  │ Directory│  │ agent    │  │  Levels    │   │
│  │ Search   │  │  Health  │  │ Messages │  │  Auto-     │   │
│  │          │  │  Metrics │  │  Events  │  │  approve   │   │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Command Bar (absorbs OpenClaw voice/text commands)  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────┬───────────────────────────────────────────┘
                   │
          ┌────────┴─────────┐
          │   Hub API        │
          │   (FastAPI)      │
          │                  │
          │  /api/v2/hub/*   │
          └────────┬─────────┘
                   │
         writes to BOTH:
                   │
       ┌───────────┼───────────┐
       │                       │
  ┌────┴──────────┐    ┌──────┴───────┐
  │ Python        │    │  Go ROAR     │
  │ Agent Registry│    │  Bus +       │
  │ (config,      │    │  Directory   │
  │  trust, tools)│    │  (DID, comms)│
  └───────────────┘    └──────────────┘
       │                       │
       └───────────┬───────────┘
                   │
  ┌────────────────┼────────────────────┐
  │           Agent Network             │
  │                                     │
  │  Built-in (12)    External (ROAR)   │
  │  PATHFINDER       PentAGI           │
  │  BREACH           AgentZero         │
  │  PHANTOM          ThePopeBot        │
  │  ...              Custom            │
  │                                     │
  │  MCP Tools (bridged)                │
  │  NanoClaw, CoPaw, Custom MCP       │
  └─────────────────────────────────────┘
```

### Single Source of Truth

The **Hub API** (Python FastAPI) is the single entry point for all agent management. When an agent is installed:

1. Hub creates the entry in Python Agent Registry (config, trust, tools, docker_image)
2. Hub calls Go's `POST /api/roar/register` to create the DID + AgentCard (see prerequisite below)
3. Hub starts the Docker container if needed
4. Both systems stay in sync

Go ROAR bus remains the communication layer — Python never handles message routing. Python handles lifecycle + configuration + trust.

### Go Prerequisite — ROAR Registration Endpoints

The Go ROAR handlers currently have no HTTP endpoint for external agent registration — `initROAR()` registers built-ins in-process only. **Before Hub API work can begin**, T2 must add two Go endpoints to `backend/cmd/roar_handlers.go`:

```
POST   /api/roar/register       Accept AgentCard JSON, register in directory, return generated DID
DELETE /api/roar/agents/{did}    Unregister agent from directory
```

Both must also be registered at `/api/v1/roar/` prefix per Harbinger's dual-route pattern. This is ~50 lines of Go — small scope, hard dependency.

### Startup Sync

On FastAPI startup, the Hub reads `GET /api/roar/agents` from Go and reconciles with the Python registry:

- **Go has agent, Python doesn't** (built-in): Python creates a registry entry with `trust_level=builtin`, `integration_type=roar`
- **Python has agent, Go doesn't** (orphaned external): Hub re-registers with Go via `POST /api/roar/register`, or marks as `offline` if container is dead
- **Both have agent**: No action, already in sync
- **Conflict**: Python-wins for external agents (Python manages lifecycle), Go-wins for built-ins (Go registers at startup)

Built-in agents are always registered by Go's `initROAR()` — Python just syncs their config.

## 4. File Structure

### New Files (Python — T2)

```
prowlrbot-engine/src/hub/
├── __init__.py
├── catalog.py          # Agent catalog — load, search, filter
├── catalog.json        # Built-in catalog entries (ships with Harbinger)
├── installer.py        # Docker pull, safety gates, container start
├── trust.py            # Trust scoring engine + performance tracking
├── sync.py             # Python Registry ↔ Go ROAR directory sync
└── mcp_bridge.py       # Register MCP tools as passive ROAR agents

prowlrbot-engine/src/routers/
└── hub.py              # Hub API endpoints

prowlrbot-engine/tests/
├── test_catalog.py
├── test_trust.py
├── test_installer.py
└── test_hub_api.py
```

### New Files (Frontend — T1)

```
harbinger-tools/frontend/src/
├── pages/AgentHub/
│   ├── AgentHub.tsx        # Main page — 4 tabs
│   ├── CatalogTab.tsx      # Browse + install agents
│   ├── ActiveTab.tsx       # Live ROAR directory view
│   ├── FeedTab.tsx         # Inter-agent message stream
│   ├── SettingsTab.tsx     # Trust config, auto-approve
│   └── CommandBar.tsx      # Voice/text command input
├── api/hub.ts              # Hub API client
└── store/hubStore.ts       # Zustand store
```

### Modified Files

| File | Change |
|------|--------|
| `prowlrbot-engine/src/main.py` | Register hub router |
| `prowlrbot-engine/src/registry/agents.py` | Add fields to `AgentDefinition` (see below) |
| `backend/cmd/roar_handlers.go` | Add `POST /api/roar/register` + `DELETE /api/roar/agents/{did}` endpoints |
| `backend/cmd/main.go` | Register new ROAR routes |

### Updated AgentDefinition Schema

Add these fields to the existing `AgentDefinition` dataclass in `agents.py`:

```python
# New fields for Agent Hub federation
trust_level: str = "builtin"          # builtin, verified, community, unknown, restricted
integration_type: str = "roar"        # roar, mcp, hybrid
roar_did: str | None = None           # W3C DID assigned during ROAR registration
roar_endpoint: str | None = None      # URL for receiving ROAR messages (external agents only)
successful_tasks: int = 0             # Performance tracking — incremented on task completion
failed_tasks: int = 0                 # Performance tracking — incremented on task failure
timed_out_tasks: int = 0              # Performance tracking — incremented on timeout
```

Defaults ensure backward compatibility — all existing built-in agents get `trust_level="builtin"`, `integration_type="roar"` with no migration needed. `to_dict()` must include these fields.
| `harbinger-tools/frontend/src/components/Layout/Sidebar.tsx` | Replace OpenClaw → Agent Hub |
| `harbinger-tools/frontend/src/App.tsx` | Replace `/openclaw` route → `/agent-hub` |
| `docker/nginx/nginx.conf` | Route `/api/v2/hub/*` to FastAPI |

## 5. Agent Catalog

### Catalog Entry Schema

```json
{
  "id": "pentagi",
  "name": "PentAGI",
  "description": "Autonomous penetration testing agent with ReAct loop, Docker sandbox, and pgvector memory",
  "author": "vxcontrol",
  "repo": "https://github.com/vxcontrol/pentagi",
  "docker_image": "ghcr.io/vxcontrol/pentagi:latest",
  "integration_type": "roar",
  "capabilities": ["web_exploitation", "recon", "code_review", "reporting"],
  "roar_endpoint": "/roar/message",
  "mcp_endpoint": null,
  "trust_tier": "community",
  "min_harbinger_version": "2.0.0",
  "config_schema": {
    "api_key": {"type": "string", "required": false, "description": "LLM API key for the agent"}
  }
}
```

### Integration Types

| Type | Protocol | Autonomy | Example |
|------|----------|----------|---------|
| `roar` | ROAR messages | Full — runs its own ReAct loop | PentAGI, AgentZero, ThePopeBot |
| `mcp` | MCP tool calls | Passive — Harbinger's LLM calls its tools | NanoClaw, CoPaw, custom scanners |
| `hybrid` | Both ROAR + MCP | Full + exposes tools | Advanced agents |

### Shipped Catalog

The initial `catalog.json` ships with entries for known agents. Users can add custom entries or the catalog auto-updates from a GitHub-hosted JSON file.

## 6. Installation Flow

### Catalog Install (One-Click)

```
User clicks "Install" on catalog entry
    │
    ▼
1. Docker pull (docker_image from catalog)
    │
    ▼
2. Safety gates:
   - No --privileged flag
   - No host network mode
   - No host volume mounts outside /work
   - Port scan: only expected ports open
   - Image size check (warn if > 5GB)
    │
    ▼
3. Start container on harbinger-network
   - Name: harbinger-ext-{agent_id}
   - Env: HARBINGER_ROAR_URL=http://backend:8080/api/roar
   - Env: HARBINGER_AGENT_DID={generated}
    │
    ▼
4. Generate W3C DID via Go ROAR identity
    │
    ▼
5. Register in Python Agent Registry:
   - codename = agent_id.upper()
   - trust_level = catalog trust_tier
   - integration_type = catalog type
   - capabilities = catalog capabilities
    │
    ▼
6. Register in Go ROAR directory:
   - POST /api/roar/register with DID + AgentCard
    │
    ▼
7. Health check — ping agent's ROAR endpoint
    │
    ▼
8. Agent appears in Active tab — ready for delegation
```

### Manual Install (Custom Agent)

Same flow but user provides:
- Docker image URL (required)
- Display name (required)
- Capabilities list (required — used for matching)
- Integration type: `roar` or `mcp` (required)
- ROAR/MCP endpoint path (default: `/roar/message` or `/mcp`)

Trust tier defaults to `unknown` — requires operator approval for every delegation until promoted.

### Uninstall

1. Stop + remove Docker container
2. Unregister from Go ROAR directory
3. Remove from Python Agent Registry
4. Preserve performance history (for re-install trust restoration)

## 7. Trust Scoring

### Trust Tiers

| Tier | Base Score | Who | Delegation Policy |
|------|-----------|-----|-------------------|
| `builtin` | 100 | Harbinger's 12 core agents (11 in Go ROAR + ADVISER Python-only) | Always auto-delegate |
| `verified` | 80 | Catalog agents with safety audit | Auto-delegate in autonomous mode |
| `community` | 50 | Catalog agents, unaudited | Requires approval on first use, then auto |
| `unknown` | 20 | Manual installs | Always requires operator approval |
| `restricted` | 0 | Failed safety gates or manually restricted | Cannot receive task delegations |

### Dynamic Trust Score

```
effective_score = base_score + performance_bonus - failure_penalty

performance_bonus = min(successful_tasks * 3, 30)   # Cap at +30
failure_penalty = failed_tasks * 10                   # No cap
timeout_penalty = timed_out_tasks * 5
```

An `unknown` agent that completes 10 tasks successfully: `20 + 30 = 50` (reaches community level). An agent that fails 3 times: `50 - 30 = 20` (drops to unknown effective score).

### Capability Matching

When ORCHESTRATOR plans a task requiring `web_exploitation`:

```python
candidates = roar_directory.search(capability="web_exploitation")
# Returns: [BREACH (builtin, 100), PentAGI (community, 65)]

# Sort by effective_score descending
# Pick highest: BREACH
# If BREACH busy/failed: fallback to PentAGI (if score > threshold)
```

Threshold for auto-delegation: `effective_score >= 50` in autonomous mode, `>= 0` with operator approval in supervised mode.

## 8. ROAR Integration Protocol

### What External Agents Must Implement

One HTTP endpoint that accepts ROAR messages:

```
POST /roar/message
Content-Type: application/json

{
  "roar": "1.0",
  "id": "msg_abc123",
  "from": {
    "did": "did:roar:agent:orchestrator-a1b2c3d4",
    "display_name": "ORCHESTRATOR",
    "agent_type": "orchestrator",
    "capabilities": ["planning", "delegation"],
    "version": "2.0.0"
  },
  "to": {
    "did": "did:roar:agent:pentagi-e5f6g7h8",
    "display_name": "PentAGI",
    "agent_type": "external",
    "capabilities": ["web_exploitation", "recon"],
    "version": "1.0.0"
  },
  "intent": "execute",
  "payload": {
    "task": "Scan example.com for SQL injection vulnerabilities",
    "context": {
      "target": "example.com",
      "scope": {"include": ["*.example.com"], "exclude": []},
      "mission_id": 42,
      "task_id": 7
    }
  },
  "auth": {"hmac": "...", "timestamp": "..."},
  "timestamp": 1711152000.0
}
```

**Note:** `from` and `to` are full `AgentIdentity` objects (matching Go's `ROARMessage` struct), not bare DID strings. The `timestamp` is a Unix float, not an ISO string. External agents receive their identity object during registration and should cache it for outgoing messages.

### How External Agents Report Results

POST back to Harbinger's ROAR bus:

```
POST http://harbinger-backend:8080/api/roar/message

{
  "roar": "1.0",
  "from": {
    "did": "did:roar:agent:pentagi-e5f6g7h8",
    "display_name": "PentAGI",
    "agent_type": "external",
    "capabilities": ["web_exploitation"],
    "version": "1.0.0"
  },
  "to": {
    "did": "did:roar:agent:orchestrator-a1b2c3d4",
    "display_name": "ORCHESTRATOR",
    "agent_type": "orchestrator",
    "capabilities": ["planning"],
    "version": "2.0.0"
  },
  "intent": "respond",
  "payload": {
    "status": "done",
    "task_id": 7,
    "result": "Found 3 SQL injection points in /api/users endpoint",
    "findings": [
      {"type": "sqli", "endpoint": "/api/users?id=1", "severity": "high", "evidence": "..."}
    ]
  },
  "timestamp": 1711152060.0
}
```

### ROAR Message Intents

| Intent | Direction | Purpose |
|--------|-----------|---------|
| `execute` | Hub → Agent | Assign a task |
| `respond` | Agent → Hub | Return task results |
| `update` | Agent → Hub | Progress update (partial results) |
| `ask` | Agent → Hub | Request operator input |
| `notify` | Either | Informational broadcast |
| `discover` | Hub → Agent | Capability probe |

### MCP Bridge

For MCP-only tools, the bridge translates:

```
ORCHESTRATOR → ROAR "execute" message
    → MCP Bridge receives
    → Translates to MCP tool_call
    → Calls external MCP server
    → Gets result
    → Wraps in ROAR "respond" message
    → Posts back to ROAR bus
```

The external MCP tool never sees ROAR. It just serves its standard MCP endpoints.

**MCP Bridge error handling:**
- MCP tool timeout (>60s): bridge sends ROAR `respond` with `status: "error"`, `error: "timeout"`
- MCP server unreachable: retry once after 5s, then fail with `status: "error"`, `error: "unreachable"`
- MCP malformed response: wrap error in ROAR `respond` with raw error message
- All errors are logged and count toward the tool's `failure_penalty` in trust scoring

## 9. Hub API Endpoints

```
# Catalog
GET  /api/v2/hub/catalog                 Browse available agents
GET  /api/v2/hub/catalog/{id}            Get catalog entry details
POST /api/v2/hub/catalog/refresh         Update catalog from remote source

# Installation
POST /api/v2/hub/install                 Install agent from catalog
POST /api/v2/hub/register               Register manual/custom agent
POST /api/v2/hub/mcp                    Register MCP tool provider
DELETE /api/v2/hub/agents/{id}          Uninstall agent

# Active Agents
GET  /api/v2/hub/agents                  List all agents (built-in + external)
GET  /api/v2/hub/agents/{id}            Get agent details + trust score
GET  /api/v2/hub/agents/{id}/health     Health check specific agent
PATCH /api/v2/hub/agents/{id}/trust     Update trust tier manually

# Federation
GET  /api/v2/hub/feed                   SSE stream of ROAR messages
GET  /api/v2/hub/feed/history           Recent ROAR messages (ring buffer)
POST /api/v2/hub/command                Command bar (absorbs OpenClaw)

# Capability Matching
GET  /api/v2/hub/match?capability=X     Find best agent for a capability
```

## 10. Frontend — Agent Hub Page

**Route:** `/agent-hub` (replaces `/openclaw`)

### Tabs

| Tab | Content | Data Source |
|-----|---------|-------------|
| **Catalog** | Grid of agent cards with install button. Search by name/capability. "Add Custom Agent" modal. Trust tier badges. | `GET /api/v2/hub/catalog` + `GET /api/v2/hub/agents` |
| **Active** | Live agent cards: DID, status, current task, last heartbeat, trust score. Start/stop/kill controls. | `GET /api/v2/hub/agents` + SSE from ROAR |
| **Feed** | Real-time ROAR message stream. Filter by agent. Shows delegation chains. Color-coded by intent. | `GET /api/v2/hub/feed` (SSE) |
| **Settings** | Per-agent trust tier override. Auto-approve threshold slider. Default delegation preferences. Safety gate config. | `GET /api/v2/hub/agents` + local state |

### Command Bar

Bottom of page. Text input + send button. Absorbs OpenClaw's `routeOpenClawCommand()` logic. Context-aware — if an agent is selected, commands go to that agent.

### Design System

Obsidian Command theme. Agent cards with trust tier color coding:
- Gold border: `builtin`
- Green border: `verified`
- Blue border: `community`
- Gray border: `unknown`
- Red border: `restricted`

## 11. Migration from OpenClaw

| Step | Change |
|------|--------|
| 1 | Add `/agent-hub` route with new page |
| 2 | Redirect `/openclaw` → `/agent-hub` |
| 3 | Move command routing logic from `openclaw.go` to Hub API |
| 4 | Keep Go `openclaw.go` as thin proxy during transition |
| 5 | After verification, remove OpenClaw frontend page + store |
| 6 | Update Sidebar: "OpenClaw" → "Agent Hub" |

## 12. Terminal Assignment

| Terminal | Scope | Key Files |
|----------|-------|-----------|
| **T2** | Go prerequisite (ROAR endpoints) + Python backend: Hub API, catalog, installer, trust engine, ROAR sync, MCP bridge, tests | `backend/cmd/roar_handlers.go` (Go), `prowlrbot-engine/src/hub/*`, `src/routers/hub.py`, `src/registry/agents.py` |
| **T1** | Frontend: Agent Hub page (4 tabs), catalog UI, active agents, feed, settings, command bar, stores | `harbinger-tools/frontend/src/pages/AgentHub/*`, `api/hub.ts`, `store/hubStore.ts` |

**Execution order:** T2 starts with Go ROAR endpoints (30 min), then Python Hub API. T1 starts frontend immediately — mock API responses until T2's endpoints are live. No conflicts — T2 builds the API, T1 builds the UI. They connect at the REST boundary (`/api/v2/hub/*`).

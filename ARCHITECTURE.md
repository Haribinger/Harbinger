# Harbinger Architecture

## System Overview

```
                         HARBINGER COMMAND CENTER
                    ┌────────────────────────────────┐
                    │       NGINX REVERSE PROXY       │
                    │  Static Assets + API Routing    │
                    └──────────┬─────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
    ┌─────────▼──────────┐         ┌────────────▼───────────┐
    │   REACT FRONTEND   │         │     GO BACKEND API     │
    │  Vite 6 + TS + SPA │         │    :8080 (44+ routes)  │
    │                     │         │                        │
    │  18 Pages           │         │  Auth (OAuth/JWT)      │
    │  14 Zustand Stores  │         │  Agent CRUD + Spawn    │
    │  Orchestrator       │         │  Skills Engine         │
    │  Workflow Editor    │         │  MCP Gateway           │
    │  Obsidian Command   │         │  Docker Manager        │
    └─────────────────────┘         │  Browser CDP           │
                                    │  Channel Relay         │
                                    │  Code Health           │
                                    │  Model Router          │
                                    └───────┬───────────────┘
                                            │
              ┌──────────────┬──────────────┼──────────────┬──────────────┐
              │              │              │              │              │
    ┌─────────▼───┐  ┌──────▼──────┐  ┌───▼────┐  ┌─────▼──────┐  ┌───▼──────┐
    │ POSTGRESQL  │  │   REDIS     │  │ NEO4J  │  │  DOCKER    │  │   MCP    │
    │   17.x      │  │   7.4       │  │ 2025   │  │  Engine    │  │ Plugins  │
    │             │  │             │  │        │  │            │  │          │
    │ Agents      │  │ Sessions    │  │ KB     │  │ Agent      │  │ HexStrike│
    │ Users       │  │ Rate Limits │  │ Graph  │  │ Containers │  │ IDOR-MCP │
    │ Jobs        │  │ Cache       │  │ Rels   │  │ Workspaces │  │ MCP-UI   │
    │ Workflows   │  │ Pub/Sub     │  │ Paths  │  │ Isolation  │  │ Custom   │
    │ Health Scans│  │             │  │        │  │            │  │          │
    └─────────────┘  └─────────────┘  └────────┘  └────────────┘  └──────────┘
```

## Component Detail

### Frontend (React 19 + Vite 6 + TypeScript)

Location: `harbinger-tools/frontend/src/`

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| Pages (18) | Route-level views | `pages/{Name}/{Name}.tsx` |
| Stores (14) | Zustand state management | `store/{name}Store.ts` |
| API Clients | Backend communication | `api/{name}.ts` |
| Core | Orchestrator, MCP, Docker | `core/orchestrator.ts` |
| Components | Reusable UI | `components/Layout/`, `components/ErrorBoundary.tsx` |

**Pages:**
Dashboard, Chat, Agents, Workflows, WorkflowEditor, MCPManager, DockerManager, BrowserManager, RedTeam, BountyHub, CommandCenter, SkillsHub, OpenClaw, CodeHealth, ScopeManager, VulnDeepDive, RemediationTracker, Settings

**Design System — Obsidian Command:**
- Background: `#0a0a0f` | Surface: `#0d0d15` | Border: `#1a1a2e`
- Accent: `#f0c040` (gold) | Danger: `#ef4444` | Success: `#22c55e`
- Font: Monospace (JetBrains Mono, Fira Code)
- No light themes. No chat bubbles. Information-dense layouts.

### Backend (Go 1.24)

Location: `backend/cmd/`

| File | Responsibility |
|------|---------------|
| `main.go` | Config, routes (44+), auth middleware, setup, dashboard |
| `database.go` | PostgreSQL CRUD, migrations, agent seeds |
| `agents.go` | Agent CRUD, spawn/stop, templates, heartbeat, soul |
| `skills.go` | Skill discovery, execution, agent mapping |
| `codehealth.go` | Health metrics, scoring, issue tracking |
| `modelrouter.go` | Smart model routing, complexity classification |
| `oauth.go` | Google OAuth, provider key validation |
| `openclaw.go` | OpenClaw gateway, events, command routing |
| `channels.go` | Discord/Telegram/Slack config and webhooks |
| `comms.go` | Agent message bus, user context, relay |
| `browsers.go` | CDP browser sessions, navigate, screenshot |

**Auth Flow:**
```
Client → JWT Token → authMiddleware() → Handler
         │
         ├── GitHub OAuth (code exchange → JWT)
         ├── GitHub Device Flow (poll → JWT)
         ├── GitHub PAT (validate → JWT)
         ├── Google OAuth (code exchange → JWT)
         └── Provider API Key (validate → JWT)
```

**Route Pattern:** Dual registration — both `/api/` and `/api/v1/` prefixes for all endpoints.

### Agent System

```
┌──────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATOR                         │
│  Frontend: orchestrator.ts    Backend: agents.go             │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │PATHFINDER│ │  BREACH  │ │ PHANTOM  │ │ SPECTER  │       │
│  │  Recon   │ │ Web Hack │ │  Cloud   │ │  OSINT   │       │
│  │ #3b82f6  │ │ #ef4444  │ │ #a855f7  │ │ #f97316  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  CIPHER  │ │  SCRIBE  │ │   SAM    │ │  BRIEF   │       │
│  │Binary RE │ │ Reports  │ │  Coding  │ │ Reporter │       │
│  │ #06b6d4  │ │ #8b5cf6  │ │ #14b8a6  │ │ #64748b  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │   SAGE   │ │   LENS   │ │MAINTAINER│                    │
│  │ Learning │ │ Browser  │ │Code Hlth │                    │
│  │ #eab308  │ │ #ec4899  │ │ #10b981  │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

**Agent Lifecycle:**
1. **Create** — POST `/api/agents` with template
2. **Spawn** — POST `/api/agents/{id}/spawn` → Docker container
3. **Heartbeat** — POST `/api/agents/{id}/heartbeat` every 15s (enriched with soul version)
4. **Soul Load** — GET `/api/agents/{id}/soul` → SOUL.md from profile directory
5. **Work** — Agent executes tasks, sends findings
6. **Stop** — POST `/api/agents/{id}/stop` → Container killed

**Agent Profile Directory:**
```
agents/{name}/
├── CONFIG.yaml     # Schedule, model routing, resource limits
├── IDENTITY.md     # Codename, color, mission
├── SOUL.md         # Personality, principles, boundaries
├── SKILLS.md       # Capabilities and tool proficiency
├── HEARTBEAT.md    # Health check protocol
└── TOOLS.md        # Tool registry and configurations
```

### Workflow Engine

Six node types in the visual workflow editor:

| Node | Purpose | Example |
|------|---------|---------|
| `triggerNode` | Start workflow | Schedule, webhook, manual |
| `agentNode` | Run an agent | PATHFINDER recon scan |
| `toolNode` | Execute a tool | nuclei, subfinder, sqlmap |
| `decisionNode` | Branch logic | If high severity → alert |
| `variableNode` | Store/transform data | Parse JSON, extract fields |
| `outputNode` | Produce results | Report, notification, API call |

Variable syntax: `{{nodeId.output}}`, `{{prev.status}}`, `{{trigger.data}}`, `{{env.VAR}}`

### MCP Plugin System

```
mcp-plugins/
├── hexstrike-ai/    # 150+ security tools via MCP protocol
├── idor-mcp/        # IDOR testing automation
└── mcp-ui/          # Visual MCP tool browser
```

MCP servers expose tools via the Model Context Protocol. The backend acts as a gateway, routing tool calls from agents to the appropriate MCP server.

### Database Schema

**PostgreSQL Tables:**
- `users` — Auth, GitHub profile, MFA settings
- `agents` — Name, type, status, config, capabilities, heartbeat timestamps
- `jobs` — Task queue for agent work items
- `workflows` — Saved workflow definitions (JSON)
- `audit_log` — All state-changing operations
- `code_health_scans` — Metric snapshots from MAINTAINER
- `model_routes` — Per-tier model routing configuration
- `model_router_config` — Global router settings

### Security Architecture

| Layer | Implementation |
|-------|---------------|
| Auth | HS256 JWT, 24h expiry, server-side state |
| Rate Limiting | 120 req/min API, 20 req/min auth, IP-based |
| CORS | Origin validation, configurable allowed origins |
| CSRF | OAuth state parameter with server-side validation |
| MFA | TOTP with 30-second window, 6-digit codes |
| Container Isolation | Per-agent Docker containers, network segmentation |
| No-Crash Policy | Missing config returns `{ok:false}`, never 500 |

## Data Flow

```
User Action → Frontend Store → API Client → Backend Handler → Database
                                                    │
                                              Docker Engine
                                                    │
                                            Agent Container
                                                    │
                                              MCP Tool Call
                                                    │
                                            Target System
```

## Build & Deploy

```bash
# Backend
cd backend && go build -o harbinger-backend ./cmd/

# Frontend
pnpm build:ui   # Output: harbinger-tools/frontend/dist/

# Full stack
docker compose up --build -d
```

# CLAUDE.md — Harbinger AI Assistant Context

> Read this ENTIRE file before making ANY changes to the codebase.

## What is Harbinger?

Harbinger is an **autonomous offensive security framework** — a local-first, MCP-powered, multi-agent platform for bug bounty hunters, red teams, and security researchers. It is NOT a chatbot. It is NOT a toy. It is a professional command center for a swarm of AI security agents.

**Current version:** v1.1.0 — Autonomous Intelligence
**Website:** https://harbinger-website.onrender.com/
**GitHub:** https://github.com/Haribinger/Harbinger

## Critical Rules

1. NEVER delete or overwrite existing files without explicit permission
2. NEVER change the project structure — it is intentional
3. NEVER add placeholder or demo code — everything must be production-ready
4. Use pnpm (not npm or yarn) — the project uses pnpm-lock.yaml at root
5. Write code like a human security engineer — comments explain WHY not WHAT, real variable names, no AI slop
6. Dark theme only — bg: #0a0a0f, accent: #f0c040 (gold), borders: #1a1a2e, text: white/gray, fonts: monospace
7. No AI chat bubbles, no typing animations, no generic AI UI — this is a command center
8. All new files go in the correct directory — check structure below
9. Do not touch pnpm-lock.yaml unless running pnpm install
10. Test before committing — `pnpm build:ui` for frontend, `cd backend && go build ./cmd/` for backend
11. NEVER log sensitive data (tokens, keys, passwords) — use generic error messages
12. NEVER commit empty `.catch(() => {})` — always add a comment or proper handling
13. NEVER leave stub/placeholder endpoints — implement real logic or return `{ok:false, reason:"not_configured"}`

## Architecture

```
HARBINGER COMMAND CENTER v1.1
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PATHFINDER│ │  BREACH  │ │ PHANTOM  │ │ SPECTER  │ │  CIPHER  │ │  SCRIBE  │
│  Recon   │ │ Web Hack │ │  Cloud   │ │  OSINT   │ │Binary RE │ │ Reports  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐
│   SAM    │ │  BRIEF   │ │   SAGE   │ │   LENS   │ │MAINTAINER│
│  Coding  │ │ Reporter │ │ Learning │ │ Browser  │ │ DevOps   │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     └──────────────┴──────────────┴──────────────┴──────────────┘
                         AGENT ORCHESTRATOR
                    + AUTONOMOUS THINKING LOOP
     ┌──────────────┬──────────────┬──────────────┬──────────────┐
     │   MCP        │   Docker     │  Knowledge   │    Git       │
     │  Servers     │  Containers  │   Graph      │   Memory     │
     │(HexStrike,   │ (per-agent   │  (Neo4j)     │ (findings    │
     │ PentAGI,     │  workspace)  │              │  persist)    │
     │ RedTeam)     │              │              │              │
     └──────────────┴──────────────┴──────────────┴──────────────┘
```

## Directory Structure

```
/
├── CLAUDE.md                    # THIS FILE — read first
├── SOUL.md                      # Global agent soul/personality
├── HEARTBEAT.md                 # Agent health check system
├── IDENTITY.md                  # Agent identity framework
├── AGENTS.md                    # Agent roster overview
├── TOOLS.md                     # Global tool configurations
├── CHANGELOG.md                 # Version changelog
├── README.md                    # Project README
├── package.json                 # Root pnpm package
├── pnpm-lock.yaml               # DO NOT EDIT MANUALLY
├── docker-compose.yml           # Full stack compose
│
├── agents/                      # Agent profiles (13 dirs, each independent)
│   ├── recon-scout/             # PATHFINDER
│   ├── web-hacker/              # BREACH
│   ├── cloud-infiltrator/       # PHANTOM
│   ├── osint-detective/         # SPECTER
│   ├── binary-reverser/         # CIPHER
│   ├── report-writer/           # SCRIBE
│   ├── coding-assistant/        # SAM
│   ├── morning-brief/           # BRIEF
│   ├── learning-agent/          # SAGE
│   ├── browser-agent/           # LENS
│   ├── maintainer/              # MAINTAINER
│   ├── shared/                  # Shared engine (autonomous-engine.js)
│   └── _template/               # For creating custom agents
│
├── harbinger-tools/
│   ├── frontend/                # React + Vite + TypeScript UI (19 pages)
│   │   └── src/
│   │       ├── pages/           # 21 page components (see Page Inventory)
│   │       ├── components/      # Reusable UI components + Layout/
│   │       ├── core/            # Orchestrator, MCP, Docker, license
│   │       ├── store/           # 19 Zustand state stores
│   │       ├── api/             # 16 API client modules
│   │       └── types/           # TypeScript interfaces
│   └── backend/                 # Go API server (see Backend Inventory)
│
├── mcp-plugins/                 # MCP server containers
│   ├── hexstrike-ai/            # 150+ security tools
│   ├── pentagi/                 # PentAGI integration
│   ├── redteam/                 # Red team MCP
│   ├── mcp-ui/                  # Visual MCP interface
│   └── visualizers/             # Data visualizers
│
├── skills/                      # 14 skill categories
│   ├── recon/                   # Reconnaissance skills
│   ├── web/                     # Web hacking skills
│   ├── cloud/                   # Cloud security skills
│   ├── osint/                   # OSINT skills
│   ├── binary-re/               # Reverse engineering skills
│   ├── network/                 # Network skills
│   ├── mobile/                  # Mobile security skills
│   ├── fuzzing/                 # Fuzzing skills
│   ├── crypto/                  # Cryptography skills
│   ├── social-engineering/      # Social engineering skills
│   ├── bugbounty/               # Bug bounty skills
│   ├── reporting/               # Report generation skills
│   └── claude-skills/           # Claude-specific skills (maintainer, etc.)
│
├── tools/go-tools/              # Go security tools (shef, recx, etc.)
├── workflows/                   # n8n + stitch workflows
├── n8n/                         # n8n automation
├── memory/                      # Agent memory entries
├── knowledge-graph/             # Entity/relation data
├── brand/                       # ASCII banners, branding
├── scripts/                     # Install/sync scripts
├── docs/                        # Documentation (ROADMAP.md, etc.)
├── templates/                   # User scaffolding templates
├── test/                        # Tests
│
└── .github/
    ├── workflows/
    │   ├── pr-health.yml        # PR health check (MAINTAINER agent)
    │   ├── maintainer-schedule.yml  # Nightly maintenance
    │   ├── ci.yml               # Build + lint on push/PR
    │   └── community-welcome.yml    # Auto-welcome new contributors
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.yml
    │   ├── feature_request.yml
    │   └── agent_request.yml
    └── pull_request_template.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TypeScript + Zustand + Radix UI + Monaco Editor + @xyflow/react + Recharts |
| Backend | Go 1.24 (13 handler files, 100+ routes) |
| Database | PostgreSQL 17 (pgvector) + Redis 7.4 + Neo4j 2025.01 |
| Containers | Docker + Docker Compose (9 services) |
| Package Manager | pnpm 9+ |
| Proxy | Caido (replaces Burp) |
| Workflows | n8n + Stitch visual editor |
| MCP | Model Context Protocol (6 plugins) |
| CI/CD | GitHub Actions (4 workflows) |

## Design System — "Obsidian Command"

| Token | Value |
|-------|-------|
| Background | `#0a0a0f` |
| Surface | `#0d0d15` |
| Borders | `#1a1a2e` |
| Accent | `#f0c040` (gold/yellow) |
| Danger | `#ef4444` |
| Success | `#22c55e` |
| Info | `#00d4ff` (cyber blue) |
| Text Primary | `#ffffff` |
| Text Secondary | `#9ca3af` |
| Text Muted | `#555555` |
| Font | Monospace — JetBrains Mono, Fira Code |

Principles: information-dense, three-column layouts, interactive graphs, live feeds, terminal-style code blocks, status indicators everywhere. Every page must feel like a command center panel, not a web app.

## Agent Roster (11 Agents)

| Codename | Role | Directory | Primary Tools |
|----------|------|-----------|---------------|
| PATHFINDER | Recon Scout | `recon-scout/` | subfinder, httpx, naabu, shef, ceye |
| BREACH | Web Hacker | `web-hacker/` | nuclei, sqlmap, dalfox, ffuf, recx |
| PHANTOM | Cloud Infiltrator | `cloud-infiltrator/` | ScoutSuite, Prowler, Pacu |
| SPECTER | OSINT Detective | `osint-detective/` | theHarvester, Sherlock, SpiderFoot |
| CIPHER | Binary RE | `binary-reverser/` | Ghidra, radare2, pwntools |
| SCRIBE | Report Writer | `report-writer/` | Markdown, PDF, platform APIs |
| SAM | Coding Assistant | `coding-assistant/` | Code generation, refactoring |
| BRIEF | Morning Reporter | `morning-brief/` | Summaries, daily briefs |
| SAGE | Learning Agent | `learning-agent/` | Tutorials, knowledge base |
| LENS | Browser Agent | `browser-agent/` | CDP, screenshots, DOM interaction |
| MAINTAINER | DevOps/Health | `maintainer/` | Code health, CI/CD, nightly fixes |

Each agent has a `SOUL.md` with personality, capabilities, and a **Meta-Cognition** section for the autonomous thinking loop.

## Backend Inventory (13 Go Files)

| File | Responsibility |
|------|---------------|
| `main.go` | Config, routes (100+), auth, setup, dashboard, Docker, MCP |
| `database.go` | PostgreSQL CRUD, table init (agents, themes, thoughts, etc.) |
| `agents.go` | Agent CRUD, spawn/stop, templates (14 types), clone |
| `skills.go` | Skills listing, execution |
| `openclaw.go` | OpenClaw gateway, events, command routing |
| `channels.go` | Discord/Telegram/Slack config, token testing, webhooks |
| `comms.go` | Agent message bus, user context, conversations, relay |
| `browsers.go` | CDP browser sessions, navigate, screenshot, execute, click |
| `autonomous.go` | Autonomous thinking loop, thoughts CRUD, swarm state |
| `codehealth.go` | Code health scans, metrics, in-memory store |
| `modelrouter.go` | Smart model routing, provider management |
| `oauth.go` | OAuth2 flows (GitHub, Google) |
| `themes.go` | Theme management |

**Pattern:** Every endpoint registered at both `/api/` and `/api/v1/` prefixes.

## Frontend Inventory

### Pages (21 Components → 19 Routes)

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Overview metrics, live feeds |
| Agents | `/agents` | Agent management, spawn/stop |
| CommandCenter | `/command-center` | Real-time agent orchestration |
| Autonomous | `/autonomous` | Thinking loop dashboard, efficiency scores |
| MCPManager | `/mcp` | MCP server management |
| DockerManager | `/docker` | Container orchestration |
| BrowserManager | `/browser` | CDP browser sessions |
| SkillsHub | `/skills` | Skill categories, execution |
| Workflows | `/workflows` | Workflow listing |
| WorkflowEditor | `/workflow-editor` | Visual n8n-style editor |
| BountyHub | `/bounty-hub` | Bug bounty programs |
| ScopeManager | `/scope` | Target scope definitions |
| VulnDeepDive | `/vuln-deep-dive` | Vulnerability analysis |
| RemediationTracker | `/remediation` | Fix tracking |
| RedTeam | `/red-team` | Red team operations |
| CodeHealth | `/code-health` | Codebase health metrics |
| OpenClaw | `/openclaw` | OpenClaw gateway |
| Chat | `/chat` | Agent chat interface |
| Settings | `/settings` | Config, providers, channels, secrets |
| Login | `/login` | Authentication |
| SetupWizard | `/setup` | First-run configuration |

### Stores (19 Zustand)

`authStore` `agentStore` `autonomousStore` `mcpStore` `dockerStore` `browserStore` `workflowStore` `workflowEditorStore` `settingsStore` `secretsStore` `skillsStore` `bugBountyStore` `bountyHubStore` `setupStore` `channelStore` `codeHealthStore` `commandCenterStore` `modelRouterStore` `themeStore`

### API Modules (16)

`agents` `auth` `autonomous` `browser` `bugbounty` `chat` `client` `codeHealth` `dashboard` `docker` `mcp` `n8n` `providers` `skills` `workflows` + `index.ts` barrel

## Critical Code Patterns

### No-Crash Policy
Missing config never causes a 500. Return graceful degradation:
```go
if db == nil {
    json.NewEncoder(w).Encode(map[string]any{"ok": false, "reason": "not_configured"})
    return
}
```

### In-Memory + DB Fallback
Store data in-memory with `sync.RWMutex`, persist to PostgreSQL when available:
```go
var thoughtStore = struct {
    sync.RWMutex
    items map[string]AgentThought
}{items: make(map[string]AgentThought)}
```

### Dual Route Registration
Every handler gets both prefixes:
```go
mux.HandleFunc("POST /api/agents/thoughts", handleCreateThought)
mux.HandleFunc("POST /api/v1/agents/thoughts", handleCreateThought)
```

### Docker via Unix Socket
Never shell out to `docker` CLI. Use HTTP API:
```go
dockerAPIRequest("POST", "/v1.41/containers/create", body)
```

### Frontend API → Store → Page
```
api/autonomous.ts  →  store/autonomousStore.ts  →  pages/Autonomous.tsx
     (axios)              (zustand+persist)           (React component)
```

### Provider Fallback Chain
```tsx
const models = providers[id]?.models || PROVIDER_MODELS[id] || []
```

### API Response Normalization
```ts
return Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : [])
```

## Autonomous Thinking Loop

The core intelligence system added in v1.1. Each agent runs a 60-second background cycle:

```
gather context → identify enhancements → calculate efficiency → propose automations
```

**Efficiency formula:** `COST_BENEFIT = (TIME_SAVED * FREQUENCY) / (IMPL_COST + RUNNING_COST)` — only proposals scoring > 1.0 get surfaced.

**5 analysis dimensions:** performance, accuracy, cost, automation, collaboration

**4 automation types:** script, skill, workflow, code_change

**Key files:**
- Backend: `backend/cmd/autonomous.go` + `database.go` (ensureAutonomousTable)
- Engine: `agents/shared/autonomous-engine.js`
- Frontend: `api/autonomous.ts` → `store/autonomousStore.ts` → `pages/Autonomous/Autonomous.tsx`

## CI/CD & Automation

### GitHub Actions (4 Workflows)

| Workflow | Trigger | What It Does |
|----------|---------|-------------|
| `ci.yml` | Push to main, PRs | Build frontend + backend, lint, type-check |
| `pr-health.yml` | PR opened/updated | Run MAINTAINER health scans, post score comment, apply labels |
| `maintainer-schedule.yml` | Nightly 2AM UTC + manual | Auto-remove `console.log`, create fix PRs |
| `community-welcome.yml` | First PR/issue | Welcome message, label, assign reviewer |

### Build Commands

```bash
# Frontend (Vite SPA)
pnpm build:ui

# Backend (Go)
cd backend && go build -o /tmp/harbinger-backend ./cmd/

# Full stack
docker compose up --build
```

### Health Checks
- Backend: `GET /health`, `GET /api/health`, `GET /api/v1/health`
- Vite proxy: `/health` → :8080, `/api` → :8080

## Contributing — What to Focus On

### High Priority (Open for Community)
1. **Type safety** — ~142 `any` types in frontend need proper interfaces
2. **Test coverage** — Add integration tests for backend handlers, unit tests for stores
3. **Agent skills** — Expand the 14 skill categories with real tool wrappers
4. **MCP plugins** — Build new MCP servers for security tools
5. **Workflow templates** — Pre-built n8n-style workflows for common operations

### Medium Priority
6. **Error handling** — Replace remaining empty catches with proper error boundaries
7. **Docker templates** — Agent-specific container configs with pre-installed tools
8. **Knowledge graph** — Neo4j entity extraction from scan results
9. **Browser automation** — Playwright-based sequences for authenticated testing

### Community Contribution Guidelines
- Fork → branch → PR against `main`
- PR health check runs automatically (score must be > 30)
- Follow the design system strictly — no light themes, no non-monospace fonts
- New agents go in `agents/` with a `SOUL.md` and `SKILLS.md`
- New skills go in the correct `skills/<category>/` directory
- New pages need: API module + Zustand store + lazy-loaded route + Sidebar entry

## What NOT to Do

- No chatbot UI (no chat bubbles, no typing indicators)
- No light themes
- No unnecessary dependencies
- No hardcoded API keys or tokens in source
- No modifying agent personalities without permission
- No Telegram/Discord/Slack in core — channels are plugins
- No npm or yarn — use pnpm
- No files outside established directory structure
- No "AI demo" features — serve real security workflows
- No `console.log` in production code — use proper logging
- No sensitive data in error messages or logs
- No stub endpoints — implement or return `not_configured`
- No `any` types in new code — use proper TypeScript interfaces


```
 _   _    _    ____  ____ ___ _   _  ____ _____ ____
| | | |  / \  |  _ \| __ )_ _| \ | |/ ___| ____|  _ \
| |_| | / _ \ | |_) |  _ \| ||  \| | |  _|  _| | |_) |
|  _  |/ ___ \|  _ <| |_) | || |\  | |_| | |___|  _ <
|_| |_/_/   \_\_| \_\____/___|_| \_|\____|_____|_| \_\
```

**Autonomous Offensive Security Framework — Local-First, MCP-Powered, Swarm Intelligence**

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8.svg)](https://go.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docs.docker.com/compose)

---

## What Is Harbinger?

Harbinger is a **command center for autonomous offensive security agents**. It is not a scanner, not a chatbot, and not a demo. It is a production framework where specialized AI agents — PATHFINDER, BREACH, PHANTOM, SPECTER, CIPHER, and SCRIBE — work as a swarm to discover vulnerabilities, map attack surfaces, and write reports.

Six agents. 150+ tools. One command center.

---

## Architecture

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PATHFINDER│ │  BREACH  │ │ PHANTOM  │ │ SPECTER  │ │  CIPHER  │ │  SCRIBE  │
│  Recon   │ │ Web Hack │ │  Cloud   │ │  OSINT   │ │Binary RE │ │ Reports  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     └──────────────────── AGENT ORCHESTRATOR ────────────────────────────┘
              │                │               │               │
         MCP Servers      Docker          Knowledge       Git Memory
       (150+ tools)     Containers         Graph
```

**Stack:** React 19 + Vite · Go 1.24 · PostgreSQL 17 · Redis 7.4 · Neo4j 2025 · Docker Compose · n8n

---

## Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 24+ | With Docker Compose v2 |
| Go | 1.24+ | For local backend dev only |
| Node.js | 20+ | For local frontend dev only |
| pnpm | 9+ | `npm i -g pnpm` |
| Git | any | |
| GitHub OAuth App | — | Required for login |

**Minimum hardware:** 4 CPU cores, 8 GB RAM, 20 GB disk

---

## Quick Start (Docker)

### 1. Clone

```bash
git clone https://github.com/kdairatchi/harbinger.git
cd harbinger
```

### 2. Configure environment

```bash
cp .env.example .env   # if .env.example exists, otherwise create .env
```

Edit `.env`:

```env
# Required — create at https://github.com/settings/developers
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

# Required — generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here

# App URL — use http://localhost for Docker, http://localhost:3000 for dev
APP_URL=http://localhost

# Optional — GitHub PAT for Device Flow auth bypass
GH_TOKEN=ghp_your_personal_access_token

# Database (defaults work for Docker)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=harbinger
POSTGRES_USER=harbinger
POSTGRES_PASSWORD=harbinger_secret
REDIS_HOST=redis
REDIS_PORT=6379
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=harbinger_neo4j

# AI provider keys (add whichever you use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 3. Set up GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**:

| Field | Value |
|-------|-------|
| Application name | Harbinger |
| Homepage URL | `http://localhost` |
| Authorization callback URL | `http://localhost/api/auth/github/callback` |

Copy the **Client ID** and **Client Secret** into `.env`.

### 4. Deploy

```bash
# Build and start core services
docker compose up --build -d postgres redis neo4j backend frontend nginx

# Check everything is running
docker compose ps

# Tail logs
docker compose logs -f backend
```

### 5. Open

Navigate to **http://localhost** and sign in with GitHub.

---

## Local Development

For live reload and faster iteration without Docker:

### Backend

```bash
cd backend
go run ./cmd/
# Runs on :8080
# Auto-loads root .env file
```

### Frontend

```bash
# From project root
pnpm install
pnpm dev
# Runs Vite SPA on :3000
# Proxies /api → :8080
```

### Build frontend for production

```bash
pnpm build:ui
# Output: harbinger-tools/frontend/dist/
# Use pnpm build:ui, NOT pnpm build (which runs Next.js and OOMs)
```

---

## Authentication Methods

Harbinger supports three login methods — pick whichever fits your setup:

### OAuth (recommended)
Standard GitHub OAuth flow. Requires `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in env. Click **"Continue with GitHub"** on the login screen.

### Device Flow
No callback URL required. Click **"Device Flow"** tab on login, scan the QR / copy the code, visit `github.com/login/device`. Requires `GITHUB_CLIENT_ID` only.

### Token
Paste a GitHub PAT (`ghp_...` or `github_pat_...`) directly into the **"Token"** tab. Or set `GH_TOKEN` in your `.env` and click **"Use Server Token"** for one-click login.

---

## Project Structure

```
/
├── CLAUDE.md                     # AI assistant context (read before editing)
├── docker-compose.yml            # 9-service stack
├── .env                          # Environment variables (git-ignored)
│
├── agents/                       # Agent system prompts
│   ├── pathfinder/SYSTEM_PROMPT.md
│   ├── breach/SYSTEM_PROMPT.md
│   ├── phantom/SYSTEM_PROMPT.md
│   ├── specter/SYSTEM_PROMPT.md
│   ├── cipher/SYSTEM_PROMPT.md
│   └── scribe/SYSTEM_PROMPT.md
│
├── backend/
│   └── cmd/
│       ├── main.go               # Go API server (1500+ lines, 44+ routes)
│       └── skills.go             # Skills execution handlers
│
├── harbinger-tools/
│   └── frontend/                 # React 19 + Vite 6 SPA
│       └── src/
│           ├── pages/            # 14 pages (Dashboard, Chat, Agents, etc.)
│           ├── components/       # Reusable UI components
│           ├── store/            # 13 Zustand stores
│           └── api/              # API client functions
│
├── mcp-plugins/                  # MCP server containers
│   ├── hexstrike-ai/             # 150+ security tools
│   └── idor-mcp/                 # IDOR testing MCP
│
├── skills/                       # Skill definitions (mounted at /app/skills)
├── workflows/                    # n8n + stitch workflows
├── memory/                       # Agent persistent memory
├── knowledge-graph/              # Neo4j entity/relation data
└── docs/                         # Documentation
```

---

## Agent Roster

| Agent | Role | Tools |
|-------|------|-------|
| **PATHFINDER** | Recon Scout | subfinder, httpx, naabu, dnsx, shef, ceye |
| **BREACH** | Web Hacker | nuclei, sqlmap, dalfox, ffuf, recx |
| **PHANTOM** | Cloud Infiltrator | ScoutSuite, Prowler, Pacu |
| **SPECTER** | OSINT Detective | theHarvester, Sherlock, SpiderFoot |
| **CIPHER** | Binary RE | Ghidra, radare2, pwntools |
| **SCRIBE** | Report Writer | Markdown, PDF, platform APIs |

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — live agent status, system metrics |
| `/agents` | Agent roster, personalities, chat |
| `/chat` | Direct agent conversation |
| `/bounty-hub` | Bug bounty programs from H1, Bugcrowd, etc. |
| `/docker` | Container management — start, stop, exec |
| `/mcp` | MCP server management — tools, call history |
| `/red-team` | C2, VPS management, Neo4j knowledge graph |
| `/browser` | Browser agent sessions (Caido proxy) |
| `/workflows` | n8n workflow canvas + editor |
| `/skills` | Skill library — view, run, manage |
| `/settings` | AI providers, API keys, theme, Docker defaults |
| `/setup` | Initial configuration wizard |

---

## Troubleshooting

### Login shows "not configured" error
OAuth is not set up. Either:
1. Add `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` to `.env` and restart, OR
2. Use the **Device Flow** tab (no callback URL needed), OR
3. Use the **Token** tab with a GitHub PAT

### Frontend changes not showing
After editing source files, restart the dev server:
```bash
# Development
pnpm dev

# Docker — rebuild frontend
docker compose up --build -d frontend nginx
```

### Backend won't start — "port already in use"
```bash
# Kill whatever is on :8080
fuser -k 8080/tcp
```

### Database connection errors
```bash
# Check Postgres is healthy
docker compose ps postgres
docker compose logs postgres

# Reset databases
docker compose down -v
docker compose up -d postgres redis neo4j
```

### pnpm: command not found
```bash
npm install -g pnpm@9
```

---

## Design System

Harbinger uses the **Obsidian Command** design language — dark, dense, terminal-native.

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0f` | Page background |
| Surface | `#0d0d15` | Cards, panels |
| Border | `#1a1a2e` | All borders |
| Accent | `#f0c040` | Gold — buttons, active states, highlights |
| Danger | `#ef4444` | Errors, destructive actions |
| Success | `#22c55e` | Running, confirmed |
| Font | JetBrains Mono / Fira Code | All monospace |

---

## Contributing

Security researchers, tool authors, and Go/React engineers welcome.

- Bug reports: [GitHub Issues](https://github.com/kdairatchi/harbinger/issues)
- Read `CLAUDE.md` before touching any code — it defines rules that must not be broken
- No light themes. No npm. No chat bubbles. No placeholder code.

---

## License

MIT — see [LICENSE.md](LICENSE.md)

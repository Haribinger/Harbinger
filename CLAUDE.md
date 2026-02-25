# CLAUDE.md — Harbinger AI Assistant Context

> Read this ENTIRE file before making ANY changes to the codebase.

## What is Harbinger?

Harbinger is an **autonomous offensive security framework** — a local-first, MCP-powered, multi-agent platform for bug bounty hunters, red teams, and security researchers. It is NOT a chatbot. It is NOT a toy. It is a professional command center for a swarm of AI security agents.

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
10. Test before committing

## Architecture

```
HARBINGER COMMAND CENTER
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PATHFINDER│ │  BREACH  │ │ PHANTOM  │ │ SPECTER  │ │  CIPHER  │ │  SCRIBE  │
│  Recon   │ │ Web Hack │ │  Cloud   │ │  OSINT   │ │Binary RE │ │ Reports  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
                              AGENT ORCHESTRATOR
     ┌──────────────┬──────────────┬──────────────┬──────────────┐
     │   MCP        │   Docker     │  Knowledge   │    Git       │
     │  Servers     │  Containers  │   Graph      │   Memory     │
     │(HexStrike,   │ (per-agent   │  (Neo4j)     │ (findings    │
     │ IDOR, etc)   │  workspace)  │              │  persist)    │
     └──────────────┴──────────────┴──────────────┴──────────────┘
```

## Directory Structure

```
/
├── CLAUDE.md                    # THIS FILE
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
├── agents/                      # Agent profiles (each independent)
│   ├── pathfinder/              # Recon Scout
│   ├── breach/                  # Web Hacker
│   ├── phantom/                 # Cloud Infiltrator
│   ├── specter/                 # OSINT Detective
│   ├── cipher/                  # Binary Reverse Engineer
│   ├── scribe/                  # Report Writer
│   └── _template/               # For creating custom agents
│
├── harbinger-tools/
│   ├── frontend/                # React + Vite + TypeScript UI
│   │   └── src/
│   │       ├── pages/           # Dashboard, Agents, BountyHub, RedTeam, etc.
│   │       ├── components/      # Reusable UI components
│   │       ├── core/            # Orchestrator, MCP, Docker, license
│   │       ├── store/           # Zustand state stores
│   │       ├── api/             # API client functions
│   │       └── types/           # TypeScript interfaces
│   └── backend/                 # Go API server
│
├── mcp-plugins/                 # MCP server containers
│   ├── hexstrike-ai/            # 150+ security tools
│   ├── mcp-ui/                  # Visual MCP interface
│   └── idor-mcp/                # IDOR testing MCP
│
├── tools/go-tools/              # Go security tools (shef, recx, etc.)
├── skills/                      # Skill files and scripts
├── workflows/                   # n8n + stitch workflows
├── n8n/                         # n8n automation
├── memory/                      # Agent memory entries
├── knowledge-graph/             # Entity/relation data
├── brand/                       # ASCII banners, branding
├── scripts/                     # Install/sync scripts
├── docs/                        # Documentation
├── templates/                   # User scaffolding templates
└── test/                        # Tests
```

## Tech Stack

- Frontend: React 19 + Vite 6 + TypeScript + Zustand + Radix UI + Monaco Editor + @xyflow/react
- Backend: Go 1.24
- Database: PostgreSQL 17 (pgvector) + Redis 7.4 + Neo4j 2025.01
- Containers: Docker + Docker Compose
- Package Manager: pnpm 9+
- Proxy: Caido (replaces Burp)
- Workflows: n8n
- MCP: Model Context Protocol

## Design System — "Obsidian Command"

- Background: #0a0a0f
- Surface: #0d0d15
- Borders: #1a1a2e
- Accent: #f0c040 (gold/yellow)
- Danger: #ef4444
- Success: #22c55e
- Text: #ffffff / #9ca3af
- Font: Monospace (JetBrains Mono, Fira Code)

Principles: information-dense, three-column layouts, interactive graphs, live feeds, terminal-style code blocks, status indicators everywhere.

## Agent Roster

| Codename | Role | Primary Tools |
|----------|------|---------------|
| PATHFINDER | Recon Scout | subfinder, httpx, naabu, shef, ceye |
| BREACH | Web Hacker | nuclei, sqlmap, dalfox, ffuf, recx |
| PHANTOM | Cloud Infiltrator | ScoutSuite, Prowler, Pacu |
| SPECTER | OSINT Detective | theHarvester, Sherlock, SpiderFoot |
| CIPHER | Binary RE | Ghidra, radare2, pwntools |
| SCRIBE | Report Writer | Markdown, PDF, platform APIs |

## What NOT to Do

- No chatbot UI (no chat bubbles, no typing indicators)
- No light themes
- No unnecessary dependencies
- No hardcoded API keys
- No modifying agent personalities without permission
- No Telegram/Discord/Slack in core — channels are plugins
- No npm or yarn — use pnpm
- No files outside established directory structure
- No "AI demo" features — serve real security workflows

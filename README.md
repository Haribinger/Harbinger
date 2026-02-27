
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
[![Agents](https://img.shields.io/badge/Agents-11-f0c040.svg)](#agent-roster)
[![Pages](https://img.shields.io/badge/Pages-19-f0c040.svg)](#pages)
[![Stores](https://img.shields.io/badge/Stores-19-f0c040.svg)](#features)

> **11 agents. 150+ tools. 19 pages. Zero API key dependencies. One command center.**

---

## What Is Harbinger?

Harbinger is a **command center for autonomous offensive security agents**. It is not a scanner, not a chatbot, and not a demo. It is a production framework where specialized AI agents work as a swarm to discover vulnerabilities, map attack surfaces, and write reports.

**[Quickstart Guide](QUICKSTART.md)** | **[Architecture](ARCHITECTURE.md)** | **[Contributing](CONTRIBUTING.md)**

---

## Features

### Agent Swarm
- **11 Specialized Agents** — PATHFINDER, BREACH, PHANTOM, SPECTER, CIPHER, SCRIBE, SAM, BRIEF, SAGE, LENS, MAINTAINER
- **Autonomous Collaboration** — Agents hand off findings, share context, work in parallel
- **Docker Containers** — Each agent runs in an isolated container with resource limits
- **Soul System** — SOUL.md personality files loaded at spawn, hot-reloaded on change
- **Heartbeat Monitoring** — 15-second health checks with soul version tracking

### Visual Workflow Engine
- **Drag-and-Drop Editor** — Build security pipelines with 6 node types
- **Real-time Execution** — Watch agents work with live logs and graphs
- **Variable System** — `{{nodeId.output}}`, `{{prev.status}}`, filters like `| count`, `| first`
- **Import/Export** — Save and share workflows as JSON

### Browser CDP System
- **Live Browser Views** — Watch agents navigate, click, and type in real-time
- **4-Tab DevTools** — Console, Network, Screenshots, Actions
- **Evidence Capture** — Screenshot and log everything for reports

### Multi-Channel Integration
- **Discord** — Agent feeds, finding alerts, slash commands
- **Telegram** — Mobile notifications and commands
- **Slack** — Team collaboration
- **OpenClaw** — Voice integration and event bus

### Security Architecture
- **Rate Limiting** — 120 req/min API, 20 req/min auth
- **MFA** — TOTP with 30-second window
- **Multi-Provider Auth** — GitHub OAuth, Google OAuth, API key validation (OpenAI, Anthropic, Groq, Mistral, Gemini)
- **No API Keys Required** — 100% local-first with Ollama default

### Smart Model Router
- **5 Complexity Tiers** — Trivial, Simple, Moderate, Complex, Massive
- **Local-First** — Ollama default, cloud fallback
- **Per-Agent Overrides** — CIPHER uses Opus, PATHFINDER uses Sonnet, MAINTAINER stays local
- **Cost Optimization** — Automatic task-to-model matching

### Code Health Dashboard
- **MAINTAINER Agent** — Nightly scans at 2AM UTC
- **Recharts Metrics** — any types, console.logs, test coverage, health score trends
- **GitHub Actions CI** — PR health checks, nightly maintenance

### Autonomous Intelligence
- **Background Thinking Loops** — Every agent runs a 60-second analysis cycle
- **Swarm Awareness** — Agents read system state, coordinate, auto-handoff tasks
- **Efficiency Tracking** — COST_BENEFIT formula filters noise, surfaces high-ROI automations
- **Meta-Cognition** — Agents monitor their own performance, propose improvements
- **Autonomous Dashboard** — Thought log, proposals, charts, approve/reject/implement actions

### Bug Bounty Pipeline
- **Scope Manager** — Dual-pane in-scope/out-of-scope asset management
- **Vulnerability Deep-Dive** — Evidence vault, code terminal, triage stepper
- **Remediation Tracker** — Kanban pipeline with SLA countdown, verification console

---

## Architecture

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PATHFINDER│ │  BREACH  │ │ PHANTOM  │ │ SPECTER  │ │  CIPHER  │ │  SCRIBE  │
│  Recon   │ │ Web Hack │ │  Cloud   │ │  OSINT   │ │Binary RE │ │ Reports  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     └──────────────────── AGENT ORCHESTRATOR ────────────────────────────┘
     │            │             │             │            │
┌────┴────┐ ┌────┴────┐ ┌─────┴────┐ ┌──────┴───┐ ┌─────┴─────┐
│MCP 150+ │ │ Docker  │ │Knowledge │ │   Git    │ │  Channels │
│ Tools   │ │Isolation│ │  Graph   │ │  Memory  │ │  Discord  │
└─────────┘ └─────────┘ └──────────┘ └──────────┘ └───────────┘
```

**Stack:** React 19 + Vite 6 + TypeScript | Go 1.24 | PostgreSQL 17 | Redis 7.4 | Neo4j 2025 | Docker Compose | MCP

Full architecture docs: **[ARCHITECTURE.md](ARCHITECTURE.md)**

---

## Quick Start

```bash
git clone https://github.com/kdairatchi/harbinger.git
cd harbinger
cp .env.example .env
docker compose up --build -d
# Open http://localhost
```

Full setup guide: **[QUICKSTART.md](QUICKSTART.md)**

---

## Agent Roster

| Agent | Color | Role | Primary Tools |
|-------|-------|------|---------------|
| **PATHFINDER** | `#3b82f6` | Recon Scout | subfinder, httpx, naabu, dnsx, shef, ceye |
| **BREACH** | `#ef4444` | Web Hacker | nuclei, sqlmap, dalfox, ffuf, recx |
| **PHANTOM** | `#a855f7` | Cloud Infiltrator | ScoutSuite, Prowler, Pacu, cloudfox |
| **SPECTER** | `#f97316` | OSINT Detective | theHarvester, Sherlock, SpiderFoot, holehe |
| **CIPHER** | `#06b6d4` | Binary RE | Ghidra, radare2, pwntools, binwalk |
| **SCRIBE** | `#8b5cf6` | Report Writer | Markdown, PDF, platform APIs, CVSS |
| **SAM** | `#14b8a6` | Coding Specialist | eslint, gofmt, TypeScript, Go, Python |
| **BRIEF** | `#64748b` | Morning Reporter | RSS, web scraping, content generation |
| **SAGE** | `#eab308` | Learning Agent | workflow optimization, self-improvement |
| **LENS** | `#ec4899` | Browser Agent | CDP navigate, screenshot, execute JS |
| **MAINTAINER** | `#10b981` | Code Health | health scans, dependency audit, safe fixes |

---

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Live agent status, system metrics, quick ops |
| `/command-center` | Command Center | Full ops view with agent controls |
| `/chat` | Chat | Direct agent conversation |
| `/agents` | Agents | Agent roster, spawn, stop, personalities |
| `/workflows` | Workflows | Workflow list and management |
| `/workflow-editor` | Workflow Editor | Visual drag-and-drop pipeline builder |
| `/mcp` | MCP Tools | MCP server management, tool browser |
| `/docker` | Docker | Container management, start/stop/exec |
| `/browsers` | Browsers | CDP browser sessions with live views |
| `/redteam` | Red Team | C2, VPS management, knowledge graph |
| `/bounty-hub` | Bounty Hub | Bug bounty programs, findings |
| `/skills` | Skills Hub | Skill library, run, manage |
| `/openclaw` | OpenClaw | Event bus, voice, command routing |
| `/code-health` | Code Health | Metrics dashboard, health scores |
| `/scope-manager` | Scope Manager | Asset scope management (in/out) |
| `/vuln-deep-dive` | Vuln Deep Dive | P1 vulnerability analysis view |
| `/remediation` | Remediation | Kanban vulnerability tracker |
| `/autonomous` | Autonomous | Agent thinking loops, swarm intelligence |
| `/settings` | Settings | Providers, channels, model router |

---

## Skills

| Skill | Agent | Purpose |
|-------|-------|---------|
| `harbinger-healthcheck` | MAINTAINER | Scan codebase for health issues |
| `harbinger-maintain` | MAINTAINER | Dependency updates, cleanup |
| `harbinger-bugfix` | SAM | Debug workflow, build checks |
| `harbinger-scaffold` | SAM | Generate new pages, stores, handlers |
| `harbinger-feature-deploy` | SAM | Full feature pipeline: plan → ship |
| `harbinger-website-sync` | SCRIBE | Sync website, docs, roadmap, GitHub |

---

## Roadmap

Full roadmap with phases: **[docs/ROADMAP.md](docs/ROADMAP.md)**

| Status | Feature |
|--------|---------|
| DONE | 11 agent profiles with SOUL.md personality + meta-cognition |
| DONE | Visual workflow editor with 6 node types |
| DONE | Browser CDP with live views and DevTools |
| DONE | Multi-provider OAuth (GitHub, Google, API keys) |
| DONE | Code health dashboard with Recharts metrics |
| DONE | Smart model router (5 tiers, local-first) |
| DONE | Scope manager from Stitch design |
| DONE | Vulnerability deep-dive view |
| DONE | Remediation tracker with Kanban pipeline |
| DONE | MAINTAINER agent + GitHub Actions CI |
| DONE | Feature deploy and website sync skills |
| DONE | GitHub templates (issues, PRs) + Codespaces |
| DONE | Autonomous Intelligence — agent thinking loops, swarm awareness |
| DONE | Autonomous Dashboard — thoughts, proposals, efficiency, charts |
| DONE | Meta-Cognition SOUL.md — 12 agents with self-awareness |
| DONE | 19 Zustand stores, 15 API modules, 100+ backend endpoints |
| PLANNED | CLI onboarding — `harbinger onboard`, `configure`, `doctor` |
| PLANNED | HTTPS + cost governance + resource usage panel |
| PLANNED | Plugin SDK + marketplace + channel registry |
| PLANNED | Persistent learning — episodic, semantic, strategic memory |
| PLANNED | Knowledge graph — Neo4j entity/relation, HowToHunt ingestion |
| PLANNED | Competitive agents + consensus verification mode |

---

## Design System

Harbinger uses **Obsidian Command** — dark, dense, terminal-native.

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0f` | Page background |
| Surface | `#0d0d15` | Cards, panels |
| Border | `#1a1a2e` | All borders |
| Accent | `#f0c040` | Gold — buttons, active, highlights |
| Danger | `#ef4444` | Errors, destructive actions |
| Success | `#22c55e` | Running, confirmed |
| Font | JetBrains Mono | All monospace |

---

## Contributing

Read **[CONTRIBUTING.md](CONTRIBUTING.md)** before submitting.

- No light themes. No npm. No chat bubbles. No placeholder code.
- Read `CLAUDE.md` — it defines rules that must not be broken.
- [Bug Reports](https://github.com/kdairatchi/harbinger/issues)

---

## License

MIT — see [LICENSE.md](LICENSE.md)

# Harbinger — Enhanced Business & Technical Plan

> A local-first, MCP-first, autonomous offensive security operating system with observable multi-agent workflow execution, persistent identity, and community-driven extensibility.

---

## 1. Executive Summary

**Harbinger** is a modular, local-first autonomous pentesting framework designed for bug bounty hunters, red team freelancers, OSINT researchers, and penetration testers who need full visibility into what their tools and agents are doing — without black boxes, without mandatory cloud dependencies, and without "AI demo" fluff.

The framework combines the best architectural ideas from **PentAGI** (multi-agent orchestration), **HexStrike AI** (150+ MCP security tools), **Agent Zero** (flexible agent framework), **ProjectDiscovery** (production-grade recon tooling), **Manus AI** (MCP-UI browser-based control), and **thepopebot** (Git-as-memory audit trail) into a single, cohesive platform.

**The core thesis**: Security professionals need an **Agent Runtime OS** — not another chatbot wrapper. Harbinger provides a workflow graph execution layer, tool orchestration engine, and observability-first dashboard where every agent action is logged, graphed, costed, and replayable.

**Key differentiators**:
- **100% local-first**: Runs entirely on Docker with Ollama/LM Studio. Zero mandatory cloud APIs.
- **MCP-first architecture**: All tools exposed via Model Context Protocol, compatible with Claude Desktop, Cursor, and any MCP client.
- **Observable by design**: DevOps-style UI with real-time event streams, timeline views, graph views, artifact downloads, and cost tracking. No fake typing bubbles.
- **Agent-to-agent workflows**: Specialized agents (recon, web, binary, cloud) hand off tasks, share knowledge, and collaborate through a formal workflow graph engine.
- **Git-as-memory**: Every significant event committed to a Git repo for full auditability and replay.
- **Community-extensible**: Plugin SDK for tools, agents, channels, workflows, and report templates.

---

## 2. Market Analysis

### 2.1 The Market Gap

The offensive security tooling market is fragmented. Individual tools (Nuclei, Subfinder, SQLMap) are excellent but disconnected. Existing "AI pentesting" platforms either require cloud APIs, lack observability, or ship superficial chat UIs that don't serve professionals.

**What professionals actually need**:
- Orchestrated workflows across multiple tools and agents
- Full visibility into what's happening (not a black box)
- Local-first operation for sensitive engagements
- Cost control when using LLMs
- Auditability for compliance and reporting
- Extensibility to add their own tools and workflows

### 2.2 Competitive Landscape

| Platform | Strengths | Weaknesses | Harbinger Advantage |
|----------|-----------|------------|---------------------|
| **PentAGI** (7,979 stars) | Multi-agent Go architecture, Docker isolation, knowledge graph, summarization | Cloud-dependent LLMs, limited tool count, no MCP support | Adopts orchestrator architecture; adds MCP-first tools, local LLM support |
| **HexStrike AI** (7,076 stars) | 150+ security tools via MCP, browser agent, real-time dashboards | Single-agent focus, no agent-to-agent workflows, no Git memory | Integrates all 150+ tools; adds workflow graph engine and multi-agent coordination |
| **Agent Zero** (15,355 stars) | Flexible agent framework, large community, rapid iteration | General-purpose (not security-focused), no observability layer, no cost governance | Borrows agent runtime patterns; specializes for offensive security with policy enforcement |
| **ProjectDiscovery Cloud** (Nuclei: 27,180 stars) | Production-grade recon tools (Nuclei, Katana, Subfinder, httpx), YAML-based DSL | Cloud platform is SaaS-only, no local agent orchestration, no multi-agent workflows | Integrates all PD tools as MCP servers; adds agent orchestration layer on top |
| **Manus AI** | Beautiful MCP-UI, browser-based control, live visualization | Proprietary, general-purpose, not security-focused | Adopts MCP-UI patterns; builds security-specific visualizations and workflows |
| **thepopebot** | Git-as-memory, job branches, auto-merge, GitHub Actions compute | Narrow scope, no security tools, no UI | Integrates Git memory as optional audit trail module |
| **HowToHunt** (7,034 stars) | Community knowledge base of bug bounty methodologies | Static markdown files, no automation, no agent integration | Ingests as knowledge base; agents learn from successful techniques |

### 2.3 Harbinger's Unique Value Proposition

Harbinger is the **only platform** that combines:
1. Multi-agent orchestration with observable workflow graphs
2. 150+ security tools via MCP protocol
3. 100% local-first operation (Ollama/LM Studio)
4. Professional DevOps-style UI (not chat bubbles)
5. Git-based audit trail for compliance
6. Community plugin ecosystem
7. Cost governance and resource controls

---

## 3. Enhanced Architecture Plan

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     JOB ORCHESTRATOR (Go)                    │
│  • Workflow graph execution    • Scope + policy enforcement  │
│  • Agent lifecycle management  • Cost governance             │
│  • Event stream (observability)• Artifact store              │
│  • Schedule engine             • Runner management           │
└──────────────────┬──────────────────────────────────────────┘
                   │ normalized events (JSON-RPC)
      ┌────────────┼───────────────┬───────────────┐
      ▼            ▼               ▼               ▼
 Web UI/CLI     Telegram/Discord   GitHub/Cron    MCP Server
 (React)        (channel plugins)  (webhooks)     (for Claude/Cursor)
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP TOOL SERVERS (Python)                   │
│  • Network tools (nmap, masscan)  • Web tools (sqlmap, xss)  │
│  • Recon tools (subfinder, httpx) • Binary tools (gdb, r2)   │
│  • Cloud tools (AWS, GCP enum)    • OSINT tools              │
│  • Browser agent (Playwright)     • Custom user tools         │
└──────────────────┬──────────────────────────────────────────┘
                   │
      ┌────────────┼───────────────┬───────────────┐
      ▼            ▼               ▼               ▼
  Docker         Neo4j           Git Memory      LLM Gateway
  Containers     Knowledge       (audit trail)   (Ollama/LM Studio/
  (isolated)     Graph                            OpenAI/Anthropic)
```

### 3.2 Core Components

| Component | Source/Inspiration | Technology | Purpose |
|-----------|-------------------|------------|---------|
| **Job Orchestrator** | PentAGI + Harbinger (Mandiant) | Go | Central workflow engine, lifecycle management, event dispatch |
| **MCP Tool Servers** | HexStrike AI | Python | 150+ security tools exposed via MCP protocol |
| **Web UI** | PentAGI + ProjectDiscovery (theme/CSS) | React + Tailwind | DevOps-style dashboard with timelines, graphs, artifact viewer |
| **Agent Runtime** | Agent Zero + PentAGI | Go/Python | Pluggable agent runtimes with standardized interface |
| **Knowledge Graph** | Graphiti + Neo4j | Neo4j | Semantic memory of entities, relationships, techniques |
| **Git Memory** | thepopebot | Node.js | Optional Git-based audit trail and replay |
| **Tool Runner** | Docker | Docker API | Each tool runs in a fresh container with resource limits |
| **LLM Gateway** | Custom | Go | Supports Ollama, LM Studio, OpenAI, Anthropic, Gemini, custom endpoints |
| **MCP-UI Renderer** | Manus AI patterns | React | Rich interactive UI components for tool responses |
| **Knowledge Base** | HowToHunt | Markdown/Embeddings | Community methodology ingestion and agent learning |

### 3.3 Agent Runtime Standard

Every agent runtime must implement this contract:

```
init(agent_config)        → Initialize agent with configuration
start_session(context)    → Begin a new session with context
plan(objective)           → Generate a structured plan
execute(step)             → Execute a single step
emit(event)               → Emit observable event
handoff(target, artifact) → Hand off to another agent
terminate(reason)         → Clean shutdown
get_capabilities()        → Declare what this agent can do
```

The orchestrator never cares **how** the agent thinks. It only dispatches events, manages lifecycle, stores outputs, and applies policy.

### 3.4 Workflow Graph Engine

**Node Types**: Agent, Tool, Condition, Approval, Delay, Handoff

**Graph Features**: Directed edges, execution state tracking, partial failure handling, retry logic, parallel branches, manual override

**Coordination Strategies** (user-selectable per workflow):
- Sequential pipeline
- Supervisor model (1 master agent delegates)
- Specialist swarm
- Competitive agents (best result wins)
- Consensus mode (multiple agents verify)

### 3.5 Observability Event Schema

Every runner and agent emits standardized events:

| Event Type | Description |
|------------|-------------|
| `THOUGHT_SUMMARY` | Safe summary of agent reasoning |
| `PLAN` | Structured steps the agent intends to take |
| `TOOL_CALL` | Tool invocation with parameters |
| `TOOL_RESULT` | Tool output and artifacts |
| `FINDING` | Discovered vulnerability or information |
| `EVIDENCE` | Supporting evidence for findings |
| `HANDOFF` | Agent-to-agent task transfer |
| `ERROR` | Error with context and recovery info |
| `COST` | Token usage, time, resource consumption |

### 3.6 MCP + MCP-UI Local Architecture

```
┌─────────────────────────────────────┐
│     MCP Client (Harbinger UI)       │
│  • React with <UIResourceRenderer/> │
│  • Runs in browser/Electron         │
└────────────┬────────────────────────┘
             │ JSON-RPC (stdio/HTTP/WebSocket)
┌────────────▼────────────────────────┐
│     MCP Orchestrator (Go)           │
│  • Routes to appropriate servers    │
│  • Enforces permissions             │
│  • Logs all actions                 │
└────────────┬────────────────────────┘
     ┌───────┼───────┬────────┐
     ▼       ▼       ▼        ▼
  LLM MCP   Tool MCP  Tool MCP  MCP-UI
  Server    Server    Server    Renderer
  (Ollama)  (nmap)    (sqlmap)  (in UI)
```

**MCP-UI Content Types**: Raw HTML (scan result previews), External URL (embed web apps), Remote DOM (host-matching UI components)

---

## 4. Feature Matrix by Phase

| Feature | Phase 0.9 | Phase 1 | Phase 1.5 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---------|:---------:|:-------:|:---------:|:-------:|:-------:|:-------:|:-------:|:-------:|
| Agent Runtime Interface | ✅ | | | | | | | |
| Workflow Graph Schema | ✅ | | | | | | | |
| Event Streaming | ✅ | | | | | | | |
| PentAGI Adapter (stub) | ✅ | | | | | | | |
| Docker-compose env fix | | ✅ | | | | | | |
| Frontend API URL fix | | ✅ | | | | | | |
| Production secret validation | | ✅ | | | | | | |
| Canonical /api/v1 path | | ✅ | | | | | | |
| `harbinger onboard` CLI | | | ✅ | | | | | |
| `harbinger configure` CLI | | | ✅ | | | | | |
| `harbinger doctor` | | | ✅ | | | | | |
| Channel registry (JSON) | | | ✅ | | | | | |
| SSL / HTTPS support | | | | ✅ | | | | |
| Cost governance layer | | | | ✅ | | | | |
| Rate limiting | | | | ✅ | | | | |
| Production doctor --prod | | | | ✅ | | | | |
| Registry-based channels | | | | | ✅ | | | |
| Orchestrator dispatch refactor | | | | | ✅ | | | |
| Plugin SDK | | | | | ✅ | | | |
| Short-term memory | | | | | | ✅ | | |
| Episodic memory (job summaries) | | | | | | ✅ | | |
| Semantic memory (embeddings) | | | | | | ✅ | | |
| Strategic memory (playbooks) | | | | | | ✅ | | |
| Neo4j Knowledge Graph | | | | | | | ✅ | |
| HowToHunt ingestion | | | | | | | ✅ | |
| Community contribution portal | | | | | | | ✅ | |
| Competitive agents mode | | | | | | | | ✅ |
| Consensus verification | | | | | | | | ✅ |
| Cross-channel identity | | | | | | | | ✅ |
| Full website deployment | | | | | | | | ✅ |

---

## 5. Technical Stack Recommendations

### 5.1 Frontend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React 18+ with TypeScript | Industry standard, large ecosystem, PentAGI already uses React |
| **Styling** | Tailwind CSS + ProjectDiscovery-inspired theme | Professional dark theme, utility-first, responsive |
| **State Management** | Zustand or Jotai | Lightweight, no boilerplate |
| **Real-time** | WebSocket + Server-Sent Events | Live event streaming for timeline/graph views |
| **Graphs** | D3.js or React Flow | Workflow graph visualization |
| **Timelines** | Custom timeline component | DevOps-style event timeline |
| **MCP-UI** | @mcp-ui/client + UIResourceRenderer | Rich interactive tool responses |
| **Build** | Vite | Fast builds, HMR |

**UI Philosophy**: Professional DevOps-style. No chat bubbles. No typing animations. Real timelines, expandable tool calls, artifact downloads, cost panels, graph views.

### 5.2 Backend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Orchestrator** | Go | Performance, concurrency, PentAGI/Harbinger already in Go |
| **MCP Servers** | Python (FastMCP) | HexStrike's 150+ tools already in Python, easy to extend |
| **API** | REST + WebSocket on /api/v1 | Standard, well-tooled |
| **Event Bus** | NATS or PostgreSQL LISTEN/NOTIFY | Lightweight, local-first (no Kafka overhead) |
| **Database** | PostgreSQL | Proven, supports JSONB for flexible schemas |
| **Knowledge Graph** | Neo4j | Semantic relationships, entity mapping |
| **Cache** | Redis (optional) | Session state, rate limiting |

### 5.3 Infrastructure

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Containerization** | Docker + Docker Compose | Isolation, reproducibility, tool sandboxing |
| **LLM (Local)** | Ollama or LM Studio | Free, private, no API keys required |
| **LLM (Cloud, optional)** | OpenAI, Anthropic, Gemini | When more power is needed |
| **Git Memory** | Local Git repo + optional GitHub push | Audit trail, replay, GitHub Actions compute |
| **Reverse Proxy** | Nginx | SSL termination, same-origin API routing |
| **Monitoring** | Prometheus + Grafana (optional) | System-level observability |

### 5.4 Local LLM Configuration

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["./dist/server.js"],
      "env": {
        "LM_BASE_URL": "http://localhost:11434/v1",
        "DEFAULT_MODEL": "qwen2.5-coder"
      }
    }
  }
}
```

**Recommended models for security work**: `qwen2.5-coder:7b` (fast, good function calling), `deepseek-coder-v2` (strong reasoning), `llama3.1:70b` (when you have GPU headroom).

---

## 6. Monetization & Community Strategy

### 6.1 Open-Source Core (Free Forever)

- Job Orchestrator
- MCP Tool Servers (all 150+ tools)
- Web UI (full dashboard)
- Agent Runtime (basic agents)
- CLI tooling
- Docker isolation
- Local LLM support

### 6.2 Premium Features (Subscription or Self-Hosted License)

| Feature | Tier |
|---------|------|
| Advanced workflow templates (pre-built pentest playbooks) | Pro |
| Team collaboration (multi-user, role-based access) | Team |
| Cloud LLM gateway with cost optimization | Pro |
| Advanced reporting (PDF/HTML pentest reports) | Pro |
| Priority support + private Discord | Pro |
| Enterprise SSO (SAML/OIDC) | Enterprise |
| Compliance reporting (SOC2, ISO27001 evidence) | Enterprise |
| Custom agent development support | Enterprise |

### 6.3 Community Ecosystem

**Plugin Marketplace**: Community-contributed tools, agents, workflows, and report templates.

**Plugin Types**:
- Tool Plugin (new MCP tool server)
- Agent Runtime Plugin (new agent type)
- Channel Plugin (new control surface)
- Workflow Template Pack (pre-built workflows)
- Report Template Pack (output formats)

**Each plugin declares**: Metadata, permissions required, capabilities, version compatibility.

**Plugin directory structure**:
```
/plugins/
  /agents/
  /tools/
  /channels/
  /workflows/
  /reports/
```

**Community incentives**: Contributor leaderboard, featured plugins, bounties for high-demand tools, "Verified" badge for quality plugins.

---

## 7. Consolidated Roadmap

### Phase 0.9 — Agent Runtime MVP (Weeks 1-3)

> Make agent-to-agent workflows observable and composable.

- [ ] Agent Runtime Interface (start_session, dispatch_task, stream_events, stop_session, get_capabilities)
- [ ] Workflow Graph Model (nodes: agent/tool/condition/approval/delay/handoff; edges: handoff + data deps)
- [ ] Observability Event Schema (THOUGHT_SUMMARY, PLAN, TOOL_CALL, TOOL_RESULT, FINDING, EVIDENCE, HANDOFF, ERROR, COST)
- [ ] Minimal PentAGI Adapter (registers as runtime plugin, launches session, emits events, runs "hello workflow")
- [ ] UI: Timeline view + graph view + expandable tool calls + artifact downloads + cost panel

**Acceptance**: Agent can start, emit events visible in UI, and complete a simple workflow.

### Phase 1 — Production Blockers (Weeks 3-4)

> Fix everything that prevents production deployment.

- [ ] Backend env vars in docker-compose (APP_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
- [ ] Frontend Dockerfile: VITE_API_URL defaults to empty for production (same-origin behind nginx)
- [ ] Production secret validation: exit with error if defaults present when APP_ENV=production
- [ ] Canonical /api/v1 base path + dev-only route inventory logging
- [ ] Single backend entrypoint used by Docker + dev

**Acceptance**: `docker compose up -d` works, `curl /api/v1/health` returns ok, setup wizard works without manual .env editing.

### Phase 1.5 — CLI Onboarding (Weeks 4-5)

> OpenClaw-style CLI: single entry point, reconfigure, doctor.

- [ ] `harbinger onboard` (--quick, --advanced, --non-interactive)
- [ ] `harbinger configure` (platform, channels, agent)
- [ ] `harbinger doctor` (--prod mode for production checks)
- [ ] Channel selection wizard + config/channels.json registry
- [ ] Update setup.sh to call `harbinger onboard`

**Acceptance**: Fresh user can run `harbinger onboard --quick` and have a working system in under 5 minutes.

### Phase 2 — Production Hardening (Weeks 5-7)

> SSL, monitoring, cost controls, security.

- [ ] HTTPS via Let's Encrypt or custom certs
- [ ] Cost governance layer (max token budget, max runtime, max tool invocations, max Docker resources, max concurrency)
- [ ] Rate limiting on API endpoints
- [ ] `harbinger doctor --prod` for production readiness checks
- [ ] Health checks for all services in docker-compose
- [ ] Resource usage panel in UI

**Acceptance**: Production deployment passes `harbinger doctor --prod` with zero warnings.

### Phase 3 — Hybrid Architecture Refactor (Weeks 7-10)

> Registry-based channels, plugin SDK, clean dispatch.

- [ ] Channel registry (Telegram, Discord, Web, GitHub, CLI all as plugins)
- [ ] Routes become thin adapters that normalize input → event → dispatch
- [ ] Orchestrator refactored to `dispatch(event)` pattern
- [ ] Plugin Development Kit (tool, agent, channel, workflow, report plugins)
- [ ] Plugin loader from /plugins/ directory
- [ ] Plugin metadata, permissions, capabilities, version compatibility

**Acceptance**: New channel can be added by dropping a plugin into /plugins/channels/ without modifying core code.

### Phase 4 — Persistent Learning Agents (Weeks 10-14)

> Agents that learn and improve over time.

- [ ] Short-term memory (session context)
- [ ] Episodic memory (job summaries, what worked/failed)
- [ ] Semantic memory (embedding index for similarity search)
- [ ] Strategic memory (playbooks derived from successful engagements)
- [ ] Confidence scoring per strategy
- [ ] Decay of stale strategies
- [ ] Feedback weighting (rating outcomes to bias future planning)
- [ ] Git Memory module (commit every significant event to Git repo)

**Acceptance**: Agent demonstrably performs better on repeated similar tasks.

### Phase 5 — Knowledge Graph & Community (Weeks 14-18)

> Collective intelligence and community contributions.

- [ ] Neo4j Knowledge Graph integration (entities, relationships, techniques)
- [ ] HowToHunt methodology ingestion (markdown → structured knowledge)
- [ ] Community contribution portal (submit tools, workflows, techniques)
- [ ] Agent Capability Matrix (compare, swap, compose agents)
- [ ] Cross-channel identity mapping (Telegram ↔ Web ↔ Discord ↔ GitHub)

**Acceptance**: Knowledge graph contains entities from past engagements; agents can query it for relevant techniques.

### Phase 6 — Advanced Features & Website (Weeks 18-24)

> Competitive agents, consensus mode, public website.

- [ ] Competitive agents mode (multiple agents attempt, best result wins)
- [ ] Consensus verification mode (multiple agents verify findings)
- [ ] Advanced MCP-UI components (interactive network graphs, vulnerability trees)
- [ ] Full website deployment (Cloudflare + GitHub Pages)
- [ ] Supabase/PostgreSQL cloud backend option
- [ ] Public documentation site
- [ ] Plugin marketplace website

**Acceptance**: Full platform accessible via web, with community plugins and public documentation.

---

## 8. Website Transition Plan

### Phase A: Current State (Local UI)

The current React UI runs locally via Docker. This is the foundation.

### Phase B: Static Documentation Site (Can Start Now)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Docs site** | GitHub Pages + Docusaurus/Nextra | Project documentation, API reference, plugin guides |
| **Domain** | Custom domain via Cloudflare | Professional presence |
| **CI/CD** | GitHub Actions | Auto-deploy on push to docs branch |

### Phase C: Cloud-Optional Dashboard (Phase 6)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | Same React app, deployed to Cloudflare Pages | Accessible from anywhere |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime) | Managed backend, free tier available |
| **Auth** | Supabase Auth (GitHub OAuth, email/password) | User management |
| **Storage** | Supabase Storage or S3 | Artifact storage for cloud mode |
| **WebSocket** | Supabase Realtime or custom | Live event streaming |

### Phase D: Full Platform

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Plugin marketplace** | Custom pages on Cloudflare | Community plugin discovery and installation |
| **User profiles** | Supabase + custom UI | Track contributions, reputation |
| **Team workspaces** | Multi-tenant backend | Collaboration features |

**Key principle**: The website is always **optional**. Local-first operation never requires cloud. The website adds convenience, collaboration, and community — but the core product works entirely offline.

---

## 9. Safety & Policy Enforcement

Since Harbinger operates in the offensive security domain, every agent must pass through:

| Layer | Purpose |
|-------|---------|
| **Scope Validator** | Ensure targets are within authorized scope |
| **Target Authorization** | Verify user has permission to test target |
| **Rate Limiter** | Prevent accidental DoS of targets |
| **Exploit Policy Filter** | Block dangerous exploits unless explicitly approved |
| **Tool Safety Filter** | Prevent destructive tool usage without confirmation |
| **Approval Gates** | Human-in-the-loop for high-risk actions |

This prevents accidental overreach and provides compliance evidence.

---

## 10. What Harbinger Is (and Is Not)

**Harbinger IS**:
- ✅ An Agent Runtime OS
- ✅ A Tool Orchestration Engine
- ✅ A Workflow Graph Execution Layer
- ✅ Observability-first
- ✅ Contributor-friendly
- ✅ Local-first, configurable for cloud

**Harbinger is NOT**:
- ❌ An AI chatbot UI
- ❌ A SaaS bug bounty marketplace
- ❌ A "prompt → tool run" wrapper
- ❌ A magic black box

> **Harbinger: A local-first, pluggable, autonomous offensive security operating system with visualized multi-agent workflow execution and persistent identity.**

---

*This document serves as both the business pitch and technical implementation guide for the Harbinger project. All work should follow the phased roadmap above. Update checkboxes as phases are completed.*

# Harbinger Roadmap

> Living document. Updated as features ship. Shipped items are summarized in [CHANGELOG.md](../CHANGELOG.md).

**Next release:** v1.3 — Chat persistence + CLI doctor + WorkflowEditor UX

---

## How to read this roadmap

| Status          | Meaning |
|-----------------|---------|
| **DONE**        | Shipped and production-ready. |
| **IN PROGRESS** | Actively being worked on. Owner shown where applicable. |
| **PLANNED**     | Not yet started; scope agreed. |

- **Phases** are roughly ordered by dependency (0.9 → 6.0). Later phases can have items started in parallel.
- **Target** column shows the release or quarter when the item is expected to ship.
- **Feature Matrix** below is the single source of truth for pages, agents, skills, and backend size. When you add a page or ship a feature, update both the phase table and the matrix.
- **Sync:** After editing, run the `harbinger-website-sync` skill or update the website/docs so external views stay in sync.

---

## Current focus (next 3 months)

**Priority order for planning and demos:**

1. **Chat persistence** — PostgreSQL-backed chat sessions, Command Center ChatPanel history (Phase 3.0).
2. **CLI** — `harbinger onboard`, `harbinger configure`, `harbinger doctor` (Phase 1.5).
3. **WorkflowEditor UX** — Guided tour, template gallery, node tooltips (Phase 6.0).
4. **Production hardening** — HTTPS (Let's Encrypt or custom), cost governance, resource panel (Phase 2.0).
5. **Knowledge graph** — Neo4j entity/relation CRUD and query API (Phase 5.0).

*Adjust this block as priorities change; it is not part of the phase tables.*

---

## Phase 0.9 — Agent Runtime MVP ✓

**Goal:** Make agent-to-agent workflows observable and composable.

**Done when:** All 11 agents can be spawned, dispatch tasks to each other, and produce observable events in the Command Center timeline.

| Status | Item | Target |
|--------|------|--------|
| DONE | Agent Runtime Interface — `start_session`, `dispatch_task`, `stream_events` via orchestrator | v0.9 |
| DONE | Workflow Graph Model — 11 node types: tool, agent, decision, trigger, output, variable, loop, http-request, delay, code, notification | v0.9 |
| DONE | Observability Event Schema — `agentStatusChange`, `taskHandoff`, `findingsShared`, `autonomousThought`, `error` | v0.9 |
| DONE | Minimal PentAGI Adapter — registered as MCP plugin at `mcp-plugins/pentagi/` | v0.9 |
| DONE | UI: Timeline view (Command Center) + graph view (Workflow Editor) + expandable tool calls + cost panel | v0.9 |
| DONE | Autonomous Intelligence — background thinking loops, swarm awareness, efficiency tracking | v1.1 |
| DONE | Meta-Cognition SOUL.md — all 11 agents have self-awareness, enhancement identification, swarm coordination | v1.1 |
| DONE | Autonomous Dashboard — `/autonomous` page with thought log, proposals, charts, automation suggestions | v1.1 |

---

## Phase 1.0 — Production Blockers ✓

**Goal:** All production blockers resolved. Ship-ready.

**Done when:** A fresh `docker compose up` succeeds, login works (3 methods), all API calls are authenticated, and rate limiting rejects abuse.

| Status | Item | Target |
|--------|------|--------|
| DONE | Docker Compose — all ports configurable via env vars, health checks on every service | v1.0 |
| DONE | Frontend — API proxy in both Vite dev server and production nginx container | v1.0 |
| DONE | Backend — JWT secret validation, error message sanitization, OAuth CSRF protection | v1.0 |
| DONE | Auth — 3-method login (OAuth, Device Flow, PAT), setup wizard with validation | v1.0 |
| DONE | Security — TOTP verification, Docker action whitelist, request body limits, rate limiting | v1.0 |
| DONE | All API calls authenticated with Bearer tokens | v1.0 |
| DONE | Multi-provider auth — GitHub OAuth, Google OAuth, API key validation | v1.0 |
| DONE | Setup wizard — 5-step onboarding with backend health check | v1.0 |

---

## Phase 1.5 — CLI Onboarding

**Goal:** Single entry point CLI: onboard, configure, doctor.

**Done when:** `harbinger doctor` runs and prints health. `harbinger onboard` creates a working `.env` and starts Docker.

| Status | Item | Target | Depends on |
|--------|------|--------|------------|
| DONE | `harbinger-healthcheck` skill — full codebase health scanning | v1.1 | — |
| DONE | `harbinger-maintain` skill — dependency updates, cleanup | v1.1 | — |
| DONE | `harbinger-bugfix` skill — debug workflow, build checks | v1.1 | — |
| DONE | `harbinger-scaffold` skill — generate new pages, stores, handlers | v1.1 | — |
| DONE | `harbinger-feature-deploy` skill — full feature pipeline: plan, build, ship | v1.1 | — |
| DONE | `harbinger-website-sync` skill — sync website, docs, roadmap, GitHub | v1.1 | — |
| IN PROGRESS | `harbinger onboard` CLI command (--quick, --advanced, --non-interactive) | v1.3 | Phase 1.0 |
| PLANNED | `harbinger configure` CLI command (platform, channels, agent) | v1.3 | `harbinger onboard` |
| PLANNED | `harbinger doctor` CLI command (--prod mode) | v1.3 | `harbinger configure` |
| PLANNED | Channel selection wizard + `config/channels.json` | v1.3 | Phase 3.0 channels |

---

## Phase 2.0 — Production Hardening

**Goal:** SSL, monitoring, cost controls.

**Done when:** HTTPS serves the UI, cost alerts fire when an agent exceeds its token budget, and the resource panel shows live CPU/memory.

| Status | Item | Target | Depends on |
|--------|------|--------|------------|
| DONE | Rate limiting on API endpoints — sliding window per-IP, 120 req/min API, 20 req/min auth | v1.0 | — |
| DONE | Health checks for all services — PostgreSQL, Redis, Neo4j, backend, MCP plugins | v1.0 | — |
| DONE | Security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options | v1.0 | — |
| DONE | Request body limits — 10MB max with configurable per-endpoint | v1.0 | — |
| DONE | CORS middleware with configurable origins | v1.0 | — |
| DONE | Code health monitoring — MAINTAINER agent nightly scans, metrics dashboard | v1.1 | — |
| DONE | Smart model router — cost optimization across 5 tiers, local-first fallback | v1.1 | — |
| PLANNED | HTTPS via Let's Encrypt or custom certs (nginx SSL config prepared) | v1.4 | — |
| PLANNED | Cost governance layer — per-agent token budgets, runtime limits, cost alerts | v1.4 | Model router |
| PLANNED | Resource usage panel in UI — CPU, memory, network per agent container | v1.4 | Docker API |

---

## Phase 3.0 — Hybrid Architecture

**Goal:** Registry-based channels, plugin SDK, clean dispatch.

**Done when:** A new channel can be added by dropping a plugin file into `/plugins/`, and Chat page persists history to PostgreSQL.

| Status | Item | Target | Depends on |
|--------|------|--------|------------|
| DONE | Channel system — Discord, Telegram, Slack configuration and webhooks | v1.0 | — |
| DONE | Agent communication bus — broadcast, messages, shared context | v1.0 | — |
| DONE | OpenClaw event bus — command routing, skill listing, webhook integration | v1.0 | — |
| DONE | MCP plugin architecture — hexstrike (150+ tools), pentagi, mcp-ui, idor-mcp | v0.9 | — |
| DONE | Chat backend — sessions, messages, SSE streaming, agent-specific responses | v1.2 | — |
| DONE | Slack relay — webhook dispatch with Block Kit formatting | v1.2 | — |
| DONE | Chat streaming UI — SSE word-by-word, auto-scroll, abort, terminal-style blocks | v1.2 | Chat backend |
| IN PROGRESS | Cross-channel conversation feed — unified message history across Discord/Telegram/Slack/Web | v1.3 | Channel system |
| PLANNED | Channel registry — Telegram, Discord, Web, GitHub, CLI as plugins | v1.4 | Plugin loader |
| PLANNED | Orchestrator refactored to `dispatch(event)` pattern | v1.4 | — |
| PLANNED | Plugin Development Kit — tool, agent, channel, workflow, report types | v1.5 | Channel registry |
| PLANNED | Plugin loader from `/plugins/` directory | v1.4 | — |

---

## Phase 4.0 — Persistent Learning

**Goal:** Agents that learn and improve over time.

**Done when:** An agent can recall findings from a previous session, build on past playbooks, and suggest "we saw this pattern before at target X".

| Status | Item | Target | Depends on |
|--------|------|--------|------------|
| DONE | Session context — agent state preserved during container lifecycle | v1.0 | — |
| DONE | SAGE learning agent — nightly optimization, pattern learning, memory system | v1.1 | — |
| DONE | Autonomous thinking loops — continuous self-improvement proposals | v1.1 | — |
| DONE | Efficiency tracking — COST_BENEFIT formula, automation classification | v1.1 | — |
| PLANNED | Episodic memory — job summaries persisted across sessions | v1.5 | PostgreSQL + pgvector |
| PLANNED | Semantic memory — embedding index with pgvector | v1.5 | pgvector extension |
| PLANNED | Strategic memory — playbooks from successful engagements | v1.6 | Episodic memory |
| PLANNED | Git Memory module — commit every significant event | v1.5 | — |

---

## Phase 5.0 — Knowledge Graph

**Goal:** Collective intelligence and community contributions.

**Done when:** Neo4j stores entities from scan results, the community portal accepts workflow submissions, and the capability matrix dynamically maps agent → skill → tool.

| Status | Item | Target | Depends on |
|--------|------|--------|------------|
| DONE | Neo4j integration — configured in Docker Compose | v0.9 | — |
| DONE | Agent swarm state — `/api/agents/swarm` endpoint for collective awareness | v1.1 | — |
| DONE | Interactive attack path graph — draggable nodes, edge highlighting, MiniMap, detail panel | v1.2 | — |
| DONE | CVE auto-triage — priority scoring, agent assignment, PATHFINDER/BREACH scan triggers | v1.2 | — |
| PLANNED | Full Neo4j knowledge graph — entity/relation CRUD, query API | v1.5 | Neo4j integration |
| PLANNED | HowToHunt methodology ingestion — automated technique library | v1.6 | Knowledge graph |
| PLANNED | Community contribution portal — share workflows, skills, templates | v2.0 | Plugin SDK |
| PLANNED | Agent Capability Matrix — dynamic skill/tool mapping | v1.5 | Knowledge graph |

---

## Phase 6.0 — Advanced Features

**Goal:** Competitive agents, consensus mode, marketplace.

**Done when:** Two agents can race on the same target and the best result wins. Marketplace has 10+ community-contributed plugins.

| Status | Item | Target | Depends on |
|--------|------|--------|------------|
| IN PROGRESS | Workflow editor beginner UX — guided tour, template gallery, node tooltips | v1.3 | — |
| PLANNED | Credential cracking integration — hashcat/john job management UI | v1.4 | Pentest dashboard |
| PLANNED | Command Center ChatPanel persistence — messages survive page navigation | v1.3 | Chat backend |
| PLANNED | Competitive agents mode — multiple agents race, best result wins | v2.0 | Agent orchestrator |
| PLANNED | Consensus verification mode — cross-agent validation of findings | v2.0 | Competitive mode |
| PLANNED | Advanced MCP-UI components — visual tool builder | v1.5 | MCP architecture |
| PLANNED | Plugin marketplace website — community sharing platform | v2.0 | Plugin SDK |
| PLANNED | MCP Registry submission — hexstrike, idor-mcp published | v1.4 | — |
| PLANNED | GitHub Models as AI provider | v1.4 | Model router |
| PLANNED | GitHub Projects integration for bounty tracking | v1.5 | — |
| PLANNED | Discord slash commands + structured channels | v1.5 | Channel registry |
| PLANNED | Nuclei Template IDE from Stitch design | v2.0 | Workflow editor |
| PLANNED | Guided onboarding tour for new users | v1.4 | — |

---

## Feature Matrix

### Pages (23)

| Route | Page | Status |
|-------|------|--------|
| `/` | Dashboard | SHIPPED |
| `/command-center` | Command Center | SHIPPED |
| `/chat` | Chat | SHIPPED (v1.2 — streaming, auto-scroll, session sidebar) |
| `/agents` | Agents | SHIPPED |
| `/workflows` | Workflows | SHIPPED |
| `/workflow-editor` | Workflow Editor | SHIPPED |
| `/mcp` | MCP Tools | SHIPPED |
| `/docker` | Docker | SHIPPED |
| `/browsers` | Browsers | SHIPPED |
| `/redteam` | Red Team | SHIPPED |
| `/bounty-hub` | Bounty Hub | SHIPPED |
| `/skills` | Skills Hub | SHIPPED |
| `/openclaw` | OpenClaw | SHIPPED (v1.2 — real channel sync) |
| `/code-health` | Code Health | SHIPPED |
| `/scope-manager` | Scope Manager | SHIPPED |
| `/vuln-deep-dive` | Vuln Deep Dive | SHIPPED |
| `/remediation` | Remediation Tracker | SHIPPED |
| `/autonomous` | Autonomous Intelligence | SHIPPED |
| `/pentest-dashboard` | Pentest Dashboard | SHIPPED (v1.2 — interactive attack paths, cracking) |
| `/cve-monitor` | CVE Monitor | SHIPPED (v1.2 — auto-triage, agent scans) |
| `/settings` | Settings | SHIPPED |
| `/login` | Login | SHIPPED |
| `/setup` | Setup Wizard | SHIPPED |

### Agents (11 + Template)

| Agent | Type | Status |
|-------|------|--------|
| PATHFINDER | Recon Scout | SHIPPED |
| BREACH | Web Hacker | SHIPPED |
| PHANTOM | Cloud Infiltrator | SHIPPED |
| SPECTER | OSINT Detective | SHIPPED |
| CIPHER | Binary RE | SHIPPED |
| SCRIBE | Report Writer | SHIPPED |
| SAM | Coding Specialist | SHIPPED |
| BRIEF | Morning Reporter | SHIPPED |
| SAGE | Learning Agent | SHIPPED |
| LENS | Browser Agent | SHIPPED |
| MAINTAINER | Code Health | SHIPPED |

### Skills (14 categories)

| Category | Skills | Agent |
|----------|--------|-------|
| Recon | subdomain enum, port scan, URL collection | PATHFINDER |
| Web | XSS, SQLi, SSRF, IDOR, API testing, fuzzing | BREACH |
| Cloud | AWS/Azure/GCP audit, IAM escalation | PHANTOM |
| OSINT | email enum, employee profiles, leak detection | SPECTER |
| Binary | reverse engineering, exploit dev, crypto analysis | CIPHER |
| Reporting | CVSS scoring, platform-optimized reports | SCRIBE |
| Coding | code generation, review, debugging, testing | SAM |
| Morning Brief | news aggregation, task summaries, agent recommendations | BRIEF |
| Learning | workflow optimization, pattern learning, self-improvement | SAGE |
| Browser | CDP navigation, screenshots, DOM analysis | LENS |
| Maintenance | health scans, dependency audit, safe auto-fixes | MAINTAINER |
| Social Engineering | phishing infra, email recon | BREACH |
| Crypto | TLS analysis, JWT attacks | CIPHER |
| Network | pivoting, lateral movement | PHANTOM |

### Backend Endpoints (120+)

Organized by domain: Auth, Agents, Workflows, Jobs, Docker, MCP, Browser, Channels, Chat, OpenClaw, Themes, Code Health, Model Router, Pentest, CVE, Autonomous Intelligence. Every endpoint has both `/api/` and `/api/v1/` prefixes.

---

## Shipped vs Planned Summary

| Category | Shipped | Planned | Total |
|----------|---------|---------|-------|
| Pages | 23 | 0 | 23 |
| Agents | 11 | 0 | 11 |
| Backend Files | 16 | 0 | 16 |
| Zustand Stores | 21 | 0 | 21 |
| API Modules | 18 | 0 | 18 |
| Skills Categories | 14 | 0 | 14 |
| Phase Items | 45 | 26 | 71 |

**Completion: 63% of full roadmap shipped.**

### Phase completion (by phase)

| Phase | Goal | Done | In Progress | Planned | % |
|-------|------|------|-------------|---------|---|
| 0.9 | Agent Runtime MVP | 8 | 0 | 0 | 100% |
| 1.0 | Production Blockers | 8 | 0 | 0 | 100% |
| 1.5 | CLI Onboarding | 6 | 1 | 3 | 60% |
| 2.0 | Production Hardening | 7 | 0 | 3 | 70% |
| 3.0 | Hybrid Architecture | 7 | 1 | 4 | 58% |
| 4.0 | Persistent Learning | 4 | 0 | 4 | 50% |
| 5.0 | Knowledge Graph | 4 | 0 | 4 | 50% |
| 6.0 | Advanced Features | 0 | 1 | 12 | 0% |

### Release targets

| Release | Target | Key deliverables |
|---------|--------|-----------------|
| v1.3 | Q2 2026 | Chat persistence, CLI doctor, WorkflowEditor UX, cross-channel feed |
| v1.4 | Q3 2026 | HTTPS, channel registry, plugin loader, credential cracking, MCP Registry |
| v1.5 | Q4 2026 | Plugin SDK, episodic/semantic memory, Neo4j CRUD, capability matrix |
| v1.6 | Q1 2027 | Strategic memory, HowToHunt ingestion, Discord slash commands |
| v2.0 | Q2 2027 | Competitive agents, consensus mode, marketplace, community portal |

---

## Backlog / Ideas

Items not yet committed to a phase. May be promoted based on community interest.

| Idea | Notes |
|------|-------|
| Mobile companion app (React Native) | Push notifications for findings, quick scope edits |
| VS Code extension | Agent chat sidebar, inline vuln annotations |
| Burp Suite plugin bridge | Import/export findings between Burp and Harbinger |
| Terraform provider | Provision Harbinger infra as code |
| Agent marketplace ratings | Community ratings and reviews for shared agents |
| Automated bounty submission | Direct submission to HackerOne/Bugcrowd from SCRIBE |
| Multi-tenant mode | Separate workspaces per team/client |
| Real-time collaboration | Multiple operators on the same Command Center |
| Webhook listener service | Catch callbacks from tools like collaborator, interactsh |
| CTF mode | Gamified agent challenges and leaderboards |

---

## Related docs

- **[CHANGELOG.md](../CHANGELOG.md)** — Version history with shipped features.
- **[ROADMAP_TIMELINE.md](ROADMAP_TIMELINE.md)** — Mermaid diagram of phase dependencies.
- **[DETAILED_IMPROVEMENT_STEPS.md](DETAILED_IMPROVEMENT_STEPS.md)** — Step-by-step tasks for quick wins, type safety, tests, skills, MCP, workflows.
- **[CHANNELS.md](CHANNELS.md)** — Discord, Telegram, Slack, WebChat: config, relay, webhooks.
- **[CHAT_INTEGRATIONS_AND_ENHANCEMENTS.md](CHAT_INTEGRATIONS_AND_ENHANCEMENTS.md)** — Chat interfaces and channel integration ideas.
- **[AGENT_GUIDE.md](AGENT_GUIDE.md)** — Agent roster and usage.

**Last updated:** 2026-02-27

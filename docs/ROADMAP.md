# Harbinger Roadmap

> Living document. Updated as features ship. Checked items are production-ready.

---

## How to read this roadmap

| Status    | Meaning |
|-----------|--------|
| **DONE**  | Shipped and production-ready. |
| **PLANNED** | Not yet started; scope agreed. |
| **IN PROGRESS** | Actively being worked on (use sparingly). |

- **Phases** are roughly ordered by dependency (0.9 → 6.0). Later phases can have items started in parallel.
- **Feature Matrix** below is the single source of truth for pages, agents, skills, and backend size. When you add a page or ship a feature, update both the phase table and the matrix.
- **Sync:** After editing, run the `harbinger-website-sync` skill or update the website/docs so external views stay in sync.

---

## Current focus (next 3 months)

**Priority order for planning and demos:**

1. **Chat & channels** — Backend `/api/chat/*` persistence, Slack relay, cross-channel conversation feed in UI.
2. **CLI** — `harbinger onboard`, `harbinger configure`, `harbinger doctor` (Phase 1.5).
3. **Production hardening** — HTTPS (Let's Encrypt or custom), cost governance, resource panel (Phase 2.0).
4. **Knowledge graph** — Neo4j entity/relation CRUD and query API (Phase 5.0).

*Adjust this block as priorities change; it is not part of the phase tables.*

---

## Phase 0.9 — Agent Runtime MVP

**Goal:** Make agent-to-agent workflows observable and composable.

| Status | Item |
|--------|------|
| DONE | Agent Runtime Interface — `start_session`, `dispatch_task`, `stream_events` via orchestrator |
| DONE | Workflow Graph Model — 11 node types: tool, agent, decision, trigger, output, variable, loop, http-request, delay, code, notification |
| DONE | Observability Event Schema — `agentStatusChange`, `taskHandoff`, `findingsShared`, `autonomousThought`, `error` |
| DONE | Minimal PentAGI Adapter — registered as MCP plugin at `mcp-plugins/pentagi/` |
| DONE | UI: Timeline view (Command Center) + graph view (Workflow Editor) + expandable tool calls + cost panel |
| DONE | Autonomous Intelligence — background thinking loops, swarm awareness, efficiency tracking |
| DONE | Meta-Cognition SOUL.md — all 11 agents have self-awareness, enhancement identification, swarm coordination |
| DONE | Autonomous Dashboard — `/autonomous` page with thought log, proposals, charts, automation suggestions |

---

## Phase 1.0 — Production Blockers

**Goal:** All production blockers resolved. Ship-ready.

| Status | Item |
|--------|------|
| DONE | Docker Compose — all ports configurable via env vars, health checks on every service |
| DONE | Frontend — API proxy in both Vite dev server and production nginx container |
| DONE | Backend — JWT secret validation, error message sanitization, OAuth CSRF protection |
| DONE | Auth — 3-method login (OAuth, Device Flow, PAT), setup wizard with validation |
| DONE | Security — TOTP verification, Docker action whitelist, request body limits, rate limiting |
| DONE | All API calls authenticated with Bearer tokens |
| DONE | Multi-provider auth — GitHub OAuth, Google OAuth, API key validation |
| DONE | Setup wizard — 5-step onboarding with backend health check |

---

## Phase 1.5 — CLI Onboarding

**Goal:** Single entry point CLI: onboard, configure, doctor.

| Status | Item |
|--------|------|
| DONE | `harbinger-healthcheck` skill — full codebase health scanning |
| DONE | `harbinger-maintain` skill — dependency updates, cleanup |
| DONE | `harbinger-bugfix` skill — debug workflow, build checks |
| DONE | `harbinger-scaffold` skill — generate new pages, stores, handlers |
| DONE | `harbinger-feature-deploy` skill — full feature pipeline: plan, build, ship |
| DONE | `harbinger-website-sync` skill — sync website, docs, roadmap, GitHub |
| PLANNED | `harbinger onboard` CLI command (--quick, --advanced, --non-interactive) |
| PLANNED | `harbinger configure` CLI command (platform, channels, agent) |
| PLANNED | `harbinger doctor` CLI command (--prod mode) |
| PLANNED | Channel selection wizard + `config/channels.json` |

---

## Phase 2.0 — Production Hardening

**Goal:** SSL, monitoring, cost controls.

| Status | Item |
|--------|------|
| DONE | Rate limiting on API endpoints — sliding window per-IP, 120 req/min API, 20 req/min auth |
| DONE | Health checks for all services — PostgreSQL, Redis, Neo4j, backend, MCP plugins |
| DONE | Security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| DONE | Request body limits — 10MB max with configurable per-endpoint |
| DONE | CORS middleware with configurable origins |
| DONE | Code health monitoring — MAINTAINER agent nightly scans, metrics dashboard |
| DONE | Smart model router — cost optimization across 5 tiers, local-first fallback |
| PLANNED | HTTPS via Let's Encrypt or custom certs (nginx SSL config prepared) |
| PLANNED | Cost governance layer — per-agent token budgets, runtime limits, cost alerts |
| PLANNED | Resource usage panel in UI — CPU, memory, network per agent container |

---

## Phase 3.0 — Hybrid Architecture

**Goal:** Registry-based channels, plugin SDK, clean dispatch.

| Status | Item |
|--------|------|
| DONE | Channel system — Discord, Telegram, Slack configuration and webhooks |
| DONE | Agent communication bus — broadcast, messages, shared context |
| DONE | OpenClaw event bus — command routing, skill listing, webhook integration |
| DONE | MCP plugin architecture — hexstrike (150+ tools), pentagi, mcp-ui, idor-mcp |
| DONE | Chat backend — sessions, messages, SSE streaming, agent-specific responses |
| DONE | Slack relay — webhook dispatch with Block Kit formatting |
| DONE | Chat streaming UI — SSE word-by-word, auto-scroll, abort, terminal-style blocks |
| PLANNED | Channel registry — Telegram, Discord, Web, GitHub, CLI as plugins |
| PLANNED | Orchestrator refactored to `dispatch(event)` pattern |
| PLANNED | Plugin Development Kit — tool, agent, channel, workflow, report types |
| PLANNED | Plugin loader from `/plugins/` directory |

---

## Phase 4.0 — Persistent Learning

**Goal:** Agents that learn and improve over time.

| Status | Item |
|--------|------|
| DONE | Session context — agent state preserved during container lifecycle |
| DONE | SAGE learning agent — nightly optimization, pattern learning, memory system |
| DONE | Autonomous thinking loops — continuous self-improvement proposals |
| DONE | Efficiency tracking — COST_BENEFIT formula, automation classification |
| PLANNED | Episodic memory — job summaries persisted across sessions |
| PLANNED | Semantic memory — embedding index with pgvector |
| PLANNED | Strategic memory — playbooks from successful engagements |
| PLANNED | Git Memory module — commit every significant event |

---

## Phase 5.0 — Knowledge Graph

**Goal:** Collective intelligence and community contributions.

| Status | Item |
|--------|------|
| DONE | Neo4j integration — configured in Docker Compose |
| DONE | Agent swarm state — `/api/agents/swarm` endpoint for collective awareness |
| DONE | Interactive attack path graph — draggable nodes, edge highlighting, MiniMap, detail panel |
| DONE | CVE auto-triage — priority scoring, agent assignment, PATHFINDER/BREACH scan triggers |
| PLANNED | Full Neo4j knowledge graph — entity/relation CRUD, query API |
| PLANNED | HowToHunt methodology ingestion — automated technique library |
| PLANNED | Community contribution portal — share workflows, skills, templates |
| PLANNED | Agent Capability Matrix — dynamic skill/tool mapping |

---

## Phase 6.0 — Advanced Features

**Goal:** Competitive agents, consensus mode, marketplace.

| Status | Item |
|--------|------|
| PLANNED | Competitive agents mode — multiple agents race, best result wins |
| PLANNED | Consensus verification mode — cross-agent validation of findings |
| PLANNED | Advanced MCP-UI components — visual tool builder |
| PLANNED | Plugin marketplace website — community sharing platform |
| PLANNED | MCP Registry submission — hexstrike, idor-mcp published |
| PLANNED | GitHub Models as AI provider |
| PLANNED | GitHub Projects integration for bounty tracking |
| PLANNED | Discord slash commands + structured channels |
| PLANNED | Nuclei Template IDE from Stitch design |
| PLANNED | Guided onboarding tour for new users |
| PLANNED | Workflow editor beginner UX — guided tour, template gallery, node tooltips |
| PLANNED | Credential cracking integration — hashcat/john job management UI |
| PLANNED | Cross-channel conversation feed — unified message history across Discord/Telegram/Slack/Web |
| PLANNED | Command Center ChatPanel persistence — messages survive page navigation |

---

## Feature Matrix

### Pages (23)

| Route | Page | Status |
|-------|------|--------|
| `/` | Dashboard | SHIPPED |
| `/command-center` | Command Center | SHIPPED |
| `/chat` | Chat | SHIPPED (v1.2 — streaming, auto-scroll) |
| `/agents` | Agents | SHIPPED |
| `/workflows` | Workflows | SHIPPED |
| `/workflow-editor` | Workflow Editor | SHIPPED |
| `/mcp` | MCP Tools | SHIPPED |
| `/docker` | Docker | SHIPPED |
| `/browsers` | Browsers | SHIPPED |
| `/redteam` | Red Team | SHIPPED |
| `/bounty-hub` | Bounty Hub | SHIPPED |
| `/skills` | Skills Hub | SHIPPED |
| `/openclaw` | OpenClaw | SHIPPED |
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

| Phase | Goal | Done | Planned | % |
|-------|------|------|---------|---|
| 0.9 | Agent Runtime MVP | 9 | 0 | 100% |
| 1.0 | Production Blockers | 8 | 0 | 100% |
| 1.5 | CLI Onboarding | 7 | 4 | 64% |
| 2.0 | Production Hardening | 7 | 3 | 70% |
| 3.0 | Hybrid Architecture | 6 | 4 | 60% |
| 4.0 | Persistent Learning | 4 | 4 | 50% |
| 5.0 | Knowledge Graph | 4 | 4 | 50% |
| 6.0 | Advanced Features | 0 | 15 | 0% |

---

## Related docs

- **[DETAILED_IMPROVEMENT_STEPS.md](DETAILED_IMPROVEMENT_STEPS.md)** — Step-by-step tasks for quick wins, type safety, tests, skills, MCP, workflows.
- **[CHANNELS.md](CHANNELS.md)** — Discord, Telegram, Slack, WebChat: config, relay, webhooks.
- **[CHAT_INTEGRATIONS_AND_ENHANCEMENTS.md](CHAT_INTEGRATIONS_AND_ENHANCEMENTS.md)** — Chat interfaces and channel integration ideas.
- **[AGENT_GUIDE.md](AGENT_GUIDE.md)** — Agent roster and usage.

**Last updated:** 2026-02-26

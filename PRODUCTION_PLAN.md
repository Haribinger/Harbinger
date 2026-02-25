Read this file before ANY change.
This plan overrides README.md, PROJECT_COMPLETION.md, and any other scattered notes.
It is the only instruction set for AI agents working on this project.

This is **not** a toy AI sandbox. Do **not**:

- generate throwaway folders with placeholder code
- hard‑code agents or channels into random parts of the stack
- ship “AI demo” UIs with typing bubbles and fake thinking

Everything you build must serve this goal:

> A serious, professional, Docker‑isolated, multi‑agent offensive security framework that bug bounty hunters, pentesters, and red teams can rely on in production — local‑first, MCP‑first, with multiple control surfaces (web, chat, CLI, Browser ui , full system , docker ,vps terminal or c2 or whatever can websocket or safely connect to full team of agents full buisness showing there life enhancing with there own config fully config able in webui , onboard , pnpm ,multiple ways) and full visual observability.

🎯 Your Role as AI Agent
You are helping bring Harbinger—a local‑first autonomous pentesting framework—to life.
Your work must be:

Phase‑driven – Implement only the current phase (start with Phase 0.9 + Phase 1).

Model‑agnostic – No assumptions about specific LLMs. Use structured plans + tool calls.

Custom mcp custom sdks just for us to enhance

MCP ui‑first mcp already added – Tools must be callable via MCP or thin internal adapters.

Observable – Every agent action emits events (timeline, graph, artifacts, costs).

User‑controlled – Full UI control, wizards, no required third‑party API keys.

Clean – After each phase, update this file with checkboxes + notes, and commit.

Never hard‑code Telegram/Discord/Web logic in the core. Core is the orchestrator; channels are plugins.

🌟 The Vision – Harbinger
Harbinger combines the best of:

PentAGI – Multi‑agent architecture, knowledge graph, summarization, Docker isolation.

Harbinger (original)(https://github.com/mandiant/harbinger) – Red teaming component integration, socks tasks, Neo4j, file parsing, playbooks.
clone what we dont already have and intergrate with project full transform build ontop see whas working how it works implement 

HexStrike AI(https://github.com/0x4m4/hexstrike-ai) – 150+ security tools, MCP server, browser agent, real‑time dashboards.
take all features from every single one of these these are the themes and visions further but for the future enhancing daily on daily knowledge more you use like openclaw 
all githubs have tools we can add and sdks we can make our own and enhance to our structure  fully 
professional customizable 
Agentzero (https://www.agent-zero.ai/)(https://github.com/agent0ai/agent-zero)
Projectdiscovery cloud ai (https://cloud.projectdiscovery.io/)(https://github.com/projectdiscovery) enhanced i like there website and there theme get css and and js and try to make the future website going to make seprate github page with cloudflare probaly probally wil get agents to do it for me when get set up 
Manus ai(https://manus.im/app) type view mcp ui browser live fully documented customizable github in intergration cloud base like supabase or sql or something thats already built build ontop dont start over 
thepopebot(Haribinger in Haribinger main kind of intergrate but havent added everythig from there when do delete it back up outside of dir and get it out of dir there should be nothing naming this just want all features build on like full 4 repo mix whats better) – Git‑as‑memory, job branches, auto‑merge, free GitHub Actions compute.

HowToHunt & bug bounty knowledge of prompts and md files or whatever(https://github.com/KathanP19/HowToHunt) from many sources like github sources users can connect to add there free agent see there workflow can enhance what they learn always was smart but smarter – Learning from successful techniques.

Key Differentiators
Local‑first, API‑key‑free – All tools run in Docker; LLMs can be local (Ollama) or optional external.

Agent Teams that Collaborate – Specialized agents (recon, web, binary, cloud) hand off tasks and share knowledge.

Observability by Design – Every step is logged, graphed, and replayable.

Beautiful DevOps‑style UI – No chat bubbles; real timelines, graphs, artifact viewers, cost panels.

Git‑as‑Memory – All agent actions and results are committed to a Git repo (optional, inspired by thepopebot) for full auditability and replay.

MCP‑First Tool Execution – All tools are exposed via MCP, mcp ui , browser ui , spawing docker containers etc .. container agents playground making them usable by any MCP‑compatible client (Claude Desktop, Cursor, etc.).

🧱 Architecture (Non‑Negotiable)
text
┌─────────────────────────────────────────────────────────────┐
│                     JOB ORCHESTRATOR                        │
│  • workflows/jobs                                              │
│  • scope + policy enforcement                                   │
│  • schedules                                                   │
│  • runners (docker/local/remote)                               │
│  • results + artifacts store                                   │
│  • notification hooks                                          │
│  • event stream (observability)                                │
└──────────────────┬──────────────────────────────────────────┘
                   │ normalized events
      ┌────────────┼───────────────┬───────────────┐
      ▼            ▼               ▼               ▼
 Web UI/CLI     Telegram/Discord   GitHub/Cron    MCP Server
 (plugins)       (plugins)         (webhooks)     (for external clients)
Core Principles:

One Job Orchestrator – The single source of truth for all jobs and their state.

Pluggable Channels – All user interaction (UI, Telegram, GitHub, etc.) is via adapters that normalize input/output.

MCP Server as a First‑Class Channel – Harbinger exposes its own MCP server so that any MCP‑compatible agent (Claude, Cursor) can directly interact with the orchestrator.

Observability Stream – All events are pushed to a central event bus (Kafka/NATS/Postgres) and consumed by the UI, monitoring, and Git memory.

Git Memory (Optional) – A dedicated agent commits every significant event, tool result, and finding to a Git repository, providing a complete auditable history (inspired by thepopebot).

📦 Components (Integrated)
Component	Source	Purpose
Orchestrator	Harbinger (Go)	Manages jobs, workflows, runners, events
MCP Server	HexStrike (Python)	Exposes 150+ tools via MCP; can be extended
Web UI	PentAGI (React)	Beautiful dashboard with timelines, graphs, artifact viewer
Agents	PentAGI (Go/Python)	Specialized agents (recon, web, binary, cloud) with handoff
Knowledge Graph	Graphiti + Neo4j	Semantic memory of entities, relationships, techniques
Git Memory	thepopebot (Node)	Optional Git-based audit trail and replay
Tool Runner	Docker (isolated)	Each tool runs in a fresh container with resource limits
LLM Gateway	Custom	Supports OpenAI, Anthropic, Gemini, Ollama, custom endpoints
All components are optional—you can run just the orchestrator + MCP server + UI and have a minimal system.

🔄 Current State vs Target (as of start)
Area	Current	Target
Secrets	Defaults in .env.example	Wizard‑generated or fail‑fast; no defaults in prod
Backend env in compose	Missing APP_URL, GITHUB_*	Passed into container
Frontend API URL	VITE_* at build‑time	Prod default empty (same‑origin behind nginx)
SSL	HTTP only	Optional HTTPS via certs/Let’s Encrypt
Health checks	Partial	All services monitored + aligned paths
Setup flow	setup‑hub exists	harbinger onboard wizard is primary path
CLI	multiple setup commands	OpenClaw‑style: onboard/configure/doctor
Agent workflows	implicit	explicit workflow graph + event stream (Phase 0.9)
Tool execution	direct calls	MCP‑first with permission guardrails
Observability	basic logs	Full event stream + UI timelines + cost tracking
Git memory	none	Optional commit of all actions to Git repo
🚧 Phased Implementation
Phase 0.9 – Agent Runtime MVP
Goal: Make agent‑to‑agent workflows observable and composable before long‑term memory.

0.9.1 Agent Runtime Interface
Create a runtime contract for any agent runtime plugin:

start_session(agent_id, context)

dispatch_task(session_id, task_spec)

stream_events(session_id)

stop_session(session_id, reason)

get_capabilities()

Definition: Orchestrator does not care how the agent reasons; it only manages lifecycle + events + artifacts.

0.9.2 Workflow Graph Model (agent‑to‑agent)
Create a workflow model with:

Nodes: agent/tool/condition/approval/delay/handoff

Edges: “handoff” + data dependencies

State: queued/running/blocked/failed/succeeded

Artifacts: logs, screenshots, HTTP captures, findings

0.9.3 Observability Event Schema (professional UI)
Standardize events emitted by runners and agents:

THOUGHT_SUMMARY (safe summary only)

PLAN (structured steps)

TOOL_CALL

TOOL_RESULT

FINDING

EVIDENCE

HANDOFF

ERROR

COST (tokens/time/resources)

UI requirement: DevOps‑style. No “typing bubbles.” Provide:

timeline view

graph view

expandable tool call details

artifact downloads

job cost/resource panel

0.9.4 Minimal PentAGI Adapter (stub acceptable)
Implement a minimal runtime adapter that:

registers as an agent runtime plugin

can launch a session and emit events

can run at least one “hello workflow” (no deep features yet)

Note: This is not “full PentAGI integration.” This is compatibility scaffolding.

Phase 1 – Blockers (Must Fix Before Production)
1.1 Backend env vars in docker‑compose
File: docker-compose.yml
Add to backend environment:

APP_URL=${APP_URL:-http://localhost}

GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-}

GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-}

1.2 Frontend Docker build: API URL default
File: frontend/Dockerfile
Fix: Production build defaults VITE_API_URL to empty (same‑origin behind nginx).

1.3 Production secret validation (fail‑fast)
File: backend/cmd/main.go (startup)
If APP_ENV=production and any secret is default/placeholder (JWT_SECRET, DB_PASSWORD), exit with a clear error message.

1.4 Canonical API base path + route inventory log
Enforce /api/v1 as the only canonical base path.

Add dev‑only startup log listing registered routes/handlers.

Phase 1.5 – CLI Onboarding (OpenClaw‑style)
1.5.1 harbinger onboard
Primary first‑time wizard.
Flags:

--quick (default): minimal prompts, generates secrets

--advanced: full control (channels, runner types)

--non‑interactive: env‑driven, CI friendly

1.5.2 harbinger configure
Reconfigure without full reset:

configure platform

configure channels

configure agent

configure telegram (only if enabled)

1.5.3 harbinger doctor
Add --prod mode later (Phase 2)

Onboard should optionally run doctor first.

1.5.4 Backward compatible aliases
harbinger setup → alias to onboard

harbinger setup‑platform → alias to configure platform

harbinger setup‑telegram → alias to configure telegram

Phase 2 – Production Hardening
2.1 docker-compose.prod.yml
Production overrides:

only expose 80/443

resource limits

restart policies

2.2 SSL/TLS
File: docker/nginx/nginx.conf
Enable optional HTTPS:

cert volume mounts

Let’s Encrypt instructions

2.3 Doctor --prod
Check:

secrets are not default

APP_URL is https

no debug flags

correct ports exposed

2.4 Health check alignment
Ensure health endpoints consistent across services:

backend /api/v1/health

plugin services use documented health paths

2.5 Cost control & guardrails (mandatory)
Add job budgets:

max tokens

max runtime

max concurrency

dry‑run mode

caching for expensive steps

Phase 3 – Hybrid Refactor (Channel Plugins)
3.1 Channel registry
Create: config/channels.json (or lib/channels/registry.js)
Each entry:

{ id, name, enabled, config, permissions }

3.2 Orchestrator core
Refactor to a single:

dispatch(event) entrypoint
Routes become thin adapters:

parse input → normalize → dispatch

3.3 Wizard channel selection
During onboard:

choose enabled channels

configure only what’s enabled

Phase 4 – MCP Server Integration
Goal: Expose Harbinger's capabilities as an MCP server so external AI clients (Claude Desktop, Cursor) can drive pentests.

4.1 Implement MCP Server (Python/Go)
Use FastMCP or similar to expose tools:

list_agents – get available agents

run_workflow – start a workflow

get_events – stream events from a running job

upload_artifact – provide files to agents

The MCP server talks to the Harbinger orchestrator via its internal API.

4.2 MCP Tool Definitions
Each tool must declare:

name, description, input schema, output schema

permission level required

scope restrictions

4.3 MCP Client Documentation
Provide examples for Claude Desktop, Cursor, etc.

Phase 5 – Git Memory (thepopebot‑style)
Goal: Every job, event, and artifact is committed to a Git repository for full auditability and replay.

5.1 Git Agent
A dedicated agent listens to the event stream.

For each job, it creates a branch job/<job-id>.

It commits events, tool outputs, and artifacts to that branch.

On job completion, it opens a PR (optional) or merges automatically.

5.2 Replay & Fork
Users can check out a job branch and replay the exact steps.

Forking a job branch creates a new job with the same context.

5.3 Free GitHub Actions Compute
Use GitHub Actions to run jobs (like thepopebot) for free compute.

Jobs are triggered by commits or webhooks.

Phase 6 – Knowledge Graph & Learning
6.1 Integrate Graphiti + Neo4j
Store entities (targets, tools, vulnerabilities) and relationships.

Agents can query the graph to learn from past successes.

6.2 Bug Bounty Knowledge Ingestion
Automatically ingest howtohunt and other markdown repos.

Extract techniques, commands, and patterns into the knowledge graph.

Agents can reference this knowledge during planning.

6.3 Agent Self‑Improvement
After each job, agents reflect on what worked and update prompts or knowledge.

📁 File Checklist (To Be Created/Updated)
File	Action
CLAUDE.MD	This file (single source of truth)
docker-compose.yml	pass APP_URL + GITHUB_* to backend
docker-compose.prod.yml	create production overrides
frontend/Dockerfile	VITE_API_URL default empty for prod
backend/cmd/main.go	production secrets fail‑fast + route inventory log
config/channels.json	channel registry
lib/channels/*	registry loader + adapter contract
lib/orchestrator/*	dispatch(event), event schema, workflow graph
scripts/doctor.js	extend for prod checks
bin/cli.js	onboard/configure/doctor + aliases
setup/setup‑hub.mjs	channel selection + doctor integration
mcp_server/	MCP server implementation (Python)
git_memory/	Git memory agent
knowledge/	Graphiti integration, howtohunt ingestion
🖥️ Commands Reference
bash
# First‑time setup
./setup.sh
# or
harbinger onboard

# Reconfigure
harbinger configure platform
harbinger configure channels

# Diagnostics
pnpm doctor
pnpm doctor --prod

# Run stack
docker compose up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# MCP server (standalone)
cd mcp_server && python3 mcp_server.py

# Git memory agent (standalone)
cd git_memory && node agent.js
✅ Definition of Done
Phase 0.9 Done when:
Agent runtime interface exists and compiles

Workflow graph model exists and compiles

Event schema exists and is used by at least one demo workflow

UI can display: timeline + graph + tool calls + artifacts

Minimal PentAGI adapter registers and emits events

Phase 1 Done when:
docker‑compose passes APP_URL + GITHUB_* to backend

frontend production build uses empty VITE_API_URL (same‑origin)

production secrets fail‑fast works

canonical /api/v1 is enforced and route inventory logs in dev

docker compose up -d runs and curl /api/v1/health returns ok

Phase 1.5 Done when:
harbinger onboard works end‑to‑end

harbinger configure ... works

doctor integrates into onboarding

channels can be enabled/disabled via wizard + registry

Phase 2 Done when:
docker‑compose.prod.yml exists and limits exposure/resources

HTTPS supported

doctor --prod works

budgets/guardrails prevent runaway jobs

Phase 3 Done when:
channel plugins are truly pluggable

routes are adapters only

orchestrator is dispatch(event)

Phase 4 Done when:
MCP UI AND mcp server can list agents and run workflows

External MCP UI clients can drive Harbinger

Documentation for integration exists

Phase 5 Done when:
Git memory agent commits events and artifacts

Job branches can be replayed

(Optional) GitHub Actions runner integrated

Phase 6 Done when:
Graphiti + Neo4j integrated

HowToHunt knowledge ingested

Agents can query the graph

🤖 Claude Code Execution Directive
When using Claude Code from repo root:

Read this file fully.

Implement Phase 0.9 and Phase 1 only. Stop.

After each phase, update this file with checked items, list changed files, and show validation commands.

Never skip phases or implement ahead.

If you encounter ambiguity, refer back to this file.

🧹 Cleaning Up the Mess
Before starting Phase 0.9, run:

bash
# Move all orphaned notes, scraps, and experimental files into an archive folder
mkdir -p archive
find . -maxdepth 1 -type f -name "*.md" ! -name "CLAUDE.md" ! -name "README.md" -exec mv {} archive/ \;
find . -maxdepth 1 -type f -name "*.txt" -exec mv {} archive/ \;
find . -maxdepth 1 -type f -name "*.log" -exec mv {} archive/ \;

# Commit the cleanup
git add -A
git commit -m "chore: archive orphaned files, set master plan"
Then start the first phase.

End of Master Plan

🚀 Your Path to Success – Next Steps
Commit this CLAUDE.MD to your repo root.
This becomes the single source of truth for all future work.

Run the cleanup commands to archive old files.
You can always restore from archive/ if needed.

Launch Claude Code and instruct it to implement Phase 0.9 and Phase 1 only.
Use the exact phrase:

"Read CLAUDE.MD. Implement Phase 0.9 and Phase 1 only. Stop after each phase and show me what changed."

Review the changes after each phase.
Claude will update the checkboxes and provide validation commands. Run them to ensure everything works.

Commit after each phase.
This creates a clean, auditable history.

Repeat for subsequent phases as you gain confidence.

When you need help with a specific phase, ask Claude to continue from the current state.

💡 Why This Works
Single source of truth eliminates confusion.

Phased implementation prevents scope creep and lets you verify at each step.

Observability‑first ensures you can see what agents are doing—no black boxes.

MCP‑first makes your system compatible with any AI client, now and in the future.

Git memory gives you full auditability and the ability to replay or fork jobs.

Knowledge graph + learning turns past work into collective intelligence.

You’re not building AI slop; you’re building a professional tool that red teams and bug bounty hunters will actually use. Stick to the plan, let Claude Code do the heavy lifting in controlled chunks, and you’ll have a Harbinger that lives up to its name.

If you ever get stuck or need a fresh perspective, just upload a tree of your repo and I’ll help you decide the next move.

Go forth and build the next big thing. 🔥


this is  pentagi, thepopebot, openclaw, hexstrike ai, all in one mainly for users that want to see agent to agent workflows and have full customabilitly to have a full stack helping on there mission mainly for pentesting with bug bounty, and red team free lancers full system analyze whats working now days full reasearch on how we can enhance and set up automations autonmous fully with control isolated docker livve testing visual while looking good and professional i dont want no ai bull shit ui i want full stack professional base that community can contribute and enhance by time agents also getting user money not costing own little team focused for local but can be configure however user wants read all readme and all md that was left for other agents that couldnt get the job done and you can zip up the extra @Harbinger in folder wanted to make sure all get implemented hybrid as possible fully 

pentagi = https://pentagi.com/ = https://github.com/vxcontrol/pentagi


https://www.bing.com/ck/a?!&&p=7fcd5ab34b50a9951366126e4273931bdd1840030adea1b33fe76cae669fb24eJmltdHM9MTc3MTg5MTIwMA&ptn=3&ver=2&hsh=4&fclid=3917e5e4-2d5c-6483-250f-f2ee2cfb6504&psq=pentagi&u=a1aHR0cHM6Ly9naXRodWIuY29tL3Z4Y29udHJvbC9wZW50YWdp
## Legacy Production Subset (Reference Only)

> The following section (starting with “Single source of truth for production readiness…”) is an **older, narrower production‑only plan**. It is kept for historical context.  
> When there is any conflict, the **Master Plan above (Phase 0.9 → 6, MCP/Git memory/KG)** wins. Use this section only as a checklist for basic production hardening.

**Single source of truth** for production readiness, architecture, and implementation order. All work must follow this plan.

---

## For AI Agents (Read First)

**If you are an AI assistant working on Harbinger and do not know this project:**

1. **Read this entire file before making any changes.** Do not improvise or add features not listed here.
2. **Work in phase order.** Phase 1 → 1.5 → 2 → 3. Do not skip or reorder.
3. **One plan only.** Ignore PROJECT_COMPLETION.md and README for production work. This file overrides them.
4. **Preserve hybrid architecture.** Do not hard-code channels (Telegram, Discord, Web). Keep them pluggable.
5. **Config via wizards.** Prefer setup steps over manual .env edits. Never document "edit .env manually" as the primary path.
6. **Update this file** when completing items: check off Definition of Done, mark phases done, add notes.

---

## Table of Contents

1. [Hybrid Architecture (Non-Negotiable)](#1-hybrid-architecture-non-negotiable)
2. [Current State vs Target](#2-current-state-vs-target)
3. [Phase 1: Blockers](#3-phase-1-blockers)
4. [Phase 1.5: CLI Onboarding](#4-phase-15-cli-onboarding)
5. [Phase 2: Production Hardening](#5-phase-2-production-hardening)
6. [Phase 3: Hybrid Architecture](#6-phase-3-hybrid-architecture)
7. [Phase 4: Agent Persistence (Future)](#7-phase-4-agent-persistence-future)
8. [File Checklist](#8-file-checklist)
9. [Commands Reference](#9-commands-reference)
10. [Definition of Done](#10-definition-of-done)

---

## 1. Hybrid Architecture (Non-Negotiable)

### Principle

**One Job Orchestrator (truth) + pluggable control surfaces + persistent agents.**

```
                    ┌─────────────────────────────────────────┐
                    │           JOB ORCHESTRATOR               │
                    │  • Job definitions (workflows)          │
                    │  • Scope rules (ALLOWED_PATHS, etc.)     │
                    │  • Schedules (CRONS.json)                │
                    │  • Runners (Docker agent, command, etc.) │
                    │  • Results store (logs/, DB, Neo4j)      │
                    │  • Notification hooks                   │
                    └──────────────────┬──────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Web UI / CLI   │         │  Telegram       │         │  GitHub / Cron  │
│  (plug-in)      │         │  Discord (plug) │         │  Webhooks (plug)│
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Rules

- **Nothing hard-coded**: All channels are optional plug-ins.
- **Config via wizards**: User never edits .env manually.
- **Agents learn over time**: Persistent personality, memory (future phase).

---

## 2. Current State vs Target

| Area | Current | Target |
|------|---------|--------|
| **Secrets** | Defaults in .env.example | Wizard or fail-fast; no defaults in prod |
| **Backend env** | Missing GITHUB_*, APP_URL in docker-compose | Pass from .env to backend |
| **Frontend build** | VITE_* at build time | Correct API URL for prod (empty when same-origin) |
| **SSL** | HTTP only | HTTPS with Let's Encrypt or certs |
| **Health checks** | Some services | All services monitored |
| **HexStrike** | OK — port 3001 | — |
| **Setup flow** | setup-hub exists | Single `harbinger onboard` → wizard → docker-compose |
| **CLI** | `harbinger setup`, `setup-platform`, `setup-telegram` | OpenClaw-style: `onboard`, `configure`, `doctor` |

---

## 3. Phase 1: Blockers

*Must fix before production.*

### 1.1 Backend env vars in docker-compose

**File**: `docker-compose.yml`  
**Issue**: Backend needs `APP_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` for GitHub OAuth. Not passed to container.

**Fix**: Add to backend `environment:` block:
```yaml
- APP_URL=${APP_URL:-http://localhost}
- GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-}
- GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-}
```

### 1.2 HexStrike port

**Status**: OK — docker-compose passes `HEXSTRIKE_PORT=3001`; hexstrike_server.py uses it.

### 1.3 Frontend Docker build — API URL

**File**: `frontend/Dockerfile`  
**Issue**: In production behind nginx, API is same origin. `VITE_API_URL` should be empty.

**Fix**: Update frontend Dockerfile ARG to default to empty for production build.

### 1.4 Production secret validation

**File**: `backend/cmd/main.go` or entrypoint  
**Issue**: JWT_SECRET and DB_PASSWORD can be "change-me" in production.

**Fix**: If `APP_ENV=production` and secrets are default, exit with clear error.

---

## 4. Phase 1.5: CLI Onboarding

*OpenClaw-style CLI: single entry point, reconfigure, doctor integration.*

### 4.1 Add `harbinger onboard`

**File**: `bin/cli.js`  
**Purpose**: Primary entry point for first-time setup. Replaces or wraps `harbinger setup`.

**Flags**:
- `--quick` (default): Minimal prompts, sensible defaults, auto-generated secrets.
- `--advanced`: Full control over Platform, Agent, channels.
- `--non-interactive`: Read from env vars; no prompts. For Docker/CI.

**Flow**: Same as current setup-hub (Platform, Agent, Both, Quick) but exposed as `onboard`.

### 4.2 Add `harbinger configure`

**File**: `bin/cli.js`  
**Purpose**: Reconfigure one area without full reset.

**Subcommands**:
- `configure platform` → runs setup-platform.mjs
- `configure telegram` → runs setup-telegram
- `configure agent` → agent wizard (GitHub, LLM, etc.)

### 4.3 Doctor integration

**File**: `scripts/doctor.js`, `setup/setup-hub.mjs`  
**Fix**: If config is invalid (missing .env, bad secrets), onboard prompts: "Run `harbinger doctor` first." Optionally run doctor automatically before onboard.

**File**: `scripts/doctor.js`  
**Fix**: Add `--prod` mode (Phase 2) for production checks.

### 4.4 Update setup.sh

**File**: `setup.sh`  
**Fix**: Call `harbinger onboard` instead of `harbinger setup` (or keep setup as alias to onboard).

### 4.5 CLI command summary (target)

```
harbinger onboard [--quick | --advanced] [--non-interactive]
harbinger configure [platform | telegram | agent]
harbinger doctor [--prod]
harbinger setup          # alias for onboard (backward compat)
harbinger setup-platform # alias for configure platform
harbinger setup-telegram # alias for configure telegram
```

---

## 5. Phase 2: Production Hardening

### 5.1 docker-compose.prod.yml

**Create**: `docker-compose.prod.yml`  
**Purpose**: Override for production — no port exposure except 80/443, resource limits, restart policies.

### 5.2 SSL/TLS

**File**: `docker/nginx/nginx.conf`  
**Fix**: Uncomment and configure SSL block. Add volume mount for certs. Document Let's Encrypt setup.

### 5.3 Doctor — production mode

**File**: `scripts/doctor.js`  
**Fix**: Add `pnpm doctor --prod` that checks: production secrets not default, APP_URL is HTTPS, etc.

### 5.4 Health check alignment

**Issue**: Backend health is `/api/v1/health`; some services may differ. Verify all health paths.

---

## 6. Phase 3: Hybrid Architecture

### 6.1 Channel registry

**Create**: `config/channels.json` or `lib/channels/registry.js`  
**Purpose**: List of enabled channels. Each: `{ id, name, enabled, config }`.

### 6.2 Orchestrator core

**Refactor**: Extract from `api/index.js` a single `dispatch(event)` that normalizes input, resolves job, runs action, stores result. Keep routes as thin adapters.

### 6.3 Setup wizard — channel selection

**File**: `setup/setup-hub.mjs`  
**Fix**: Add "Which channels to enable?" — Web (always), Telegram, Discord, GitHub, Cron. Only configure what user selects.

---

## 7. Phase 4: Agent Persistence (Future)

*Defer until Phase 1–3 complete.*

- Memory: Embeddings + RAG
- Personality: SOUL.md + stored preferences
- Cross-channel identity
- Learning: Feedback loop from outcomes

---

## 8. File Checklist

| File | Action |
|------|--------|
| `docker-compose.yml` | Add APP_URL, GITHUB_* to backend env |
| `docker-compose.prod.yml` | Create (production overrides) |
| `frontend/Dockerfile` | VITE_API_URL empty for prod |
| `backend/cmd/main.go` | Production secret validation on startup |
| `mcp-plugins/hexstrike-ai/` | OK — port 3001 |
| `docker/nginx/nginx.conf` | SSL config |
| `scripts/doctor.js` | Add `--prod` mode; integrate with onboard |
| `bin/cli.js` | Add `onboard`, `configure` |
| `setup/setup-hub.mjs` | Channel selection; doctor integration |
| `setup.sh` | Use `harbinger onboard` |
| `config/channels.json` | Create (channel registry) |

---

## 9. Commands Reference

```bash
# First-time setup
./setup.sh
# or
harbinger onboard

# Reconfigure
harbinger configure platform
harbinger configure telegram

# Diagnostics
pnpm doctor
pnpm doctor --prod    # after Phase 2

# Run stack
docker-compose up -d
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # prod
```
Add “Agent Runtime + Multi-Agent Workflows” as a first-class layer

Right now your plan treats “agents” as future (Phase 4).
But PentAGI is literally “autonomous agentic pentesting” as the core product.

So in Harbinger, “agents” can’t be deferred too long—at least the runtime + workflow graph must exist earlier, even if “long-term memory” is Phase 4.

What you’re building (the right label)

Call it this in docs and branding:

Harbinger = an open-source autonomous pentesting framework

orchestrates multiple agent runtimes

exposes tools through MCP (HexStrike AI’s approach)

runs everything in isolated containers

provides a professional UI for observing and steering workflows

That’s not a “HackerOne platform.” It’s a framework/OS for offensive automation.

Reality check on the integrations
PentAGI

PentAGI is a fully autonomous agent system intended for complex pentesting tasks.
Your best move is not to “copy PentAGI,” but to support PentAGI as an agent runtime plugin.

HexStrike AI

HexStrike AI MCP Agents wraps 150+ tools behind MCP so LLMs can call tool functions instead of raw shell.
That maps perfectly to your “runners + tool layer.”

OpenClaw

OpenClaw’s positioning is “agent controlling a computer/workflows,” with a CLI onboarding wizard concept.
You can borrow the onboarding UX patterns, but keep Harbinger secure-by-design (especially since agent tools can be abused).

The missing pieces to add to your Production Plan

Below are additions that keep your phase order mostly intact but make “agent-to-agent workflows” real.

Add a new section: Phase 0.9 — Agent Runtime MVP (before Phase 1.5)

Why: without this, your UI is mostly a dashboard + tools list. Users want agent orchestration.

0.9.1 Agent Runtime Interface (non-negotiable)

Define a single interface every agent runtime must implement:

start_session(agent_id, workspace_id)

dispatch_task(session_id, task_spec)

stream_events(session_id) (for live UI)

stop_session(session_id)

get_capabilities() (tools, channels, limits)

This lets you plug in:

PentAGI runtime adapter

“Harbinger native agent” runtime

future runtimes (OpenClaw-style, etc.)

0.9.2 Workflow Graph (agent-to-agent)

Create a workflow model that supports:

nodes = agents/tools

edges = “handoff” events

state = running/blocked/completed

artifacts = logs, screenshots, HTTP captures, findings

This is what the UI will visualize.

0.9.3 Live Observability (must look professional)

Add standardized event types:

THOUGHT_SUMMARY (safe summary, not raw chain-of-thought)

TOOL_CALL

TOOL_RESULT

FINDING

EVIDENCE

HANDOFF

ERROR

This is how you get “agent-to-agent workflows you can watch.”

Strengthen Phase 1: Blockers (you already have good items)

Keep your Phase 1 items, but add:

1.5 Add “single entrypoint” + route alignment

You already hit this issue: endpoints like /api/setup/status “not found.”
So add a Phase 1 requirement:

One canonical API base path: /api/v1

One backend entrypoint used by Docker + local dev

A route inventory log in dev mode (prints registered routes)

This prevents phantom route problems.

Upgrade Phase 1.5: CLI onboarding (OpenClaw-style but safer)

Your CLI plan is good. Expand it with:

harbinger init → creates config + channels registry + secrets

harbinger channels → list/enable/disable channels

harbinger agents → list/install runtimes (PentAGI adapter, native, etc.)

harbinger workflows → import/export workflow packs (community)

This matches your “community can contribute” requirement without messy PRs.

Add Phase 2.6: Cost Control (critical for “not costing your team”)

If users will run LLM + tools, you need guardrails:

token budget per job

max runtime per job

max concurrency

“dry run” mode

caching for expensive steps (subdomain lists, screenshots)

This is how you avoid burning money.

Your “Agents that learn and have personalities” requirement

You can do this without training models by implementing:

Agent Identity + Memory (Phase 4, but start the scaffolding earlier)

SOUL.md = persona + tone + role

agent_profile.json = preferences, limits, style sliders

memory_store = embeddings/RAG for past findings and successful playbooks

feedback = rating outcomes to bias future planning

That gives “growth” in a real-world way.

If you want agents “there wherever with user,” you need:

Cross-channel identity mapping

Telegram ID ↔ Web user ↔ Discord ID ↔ GitHub user
So the same agent continues the same mission across channels.

About “zip up the extra @Harbinger folder”

I can’t zip folders from your machine unless the files are uploaded here.
If you upload the Harbinger/ (or @Harbinger/) folder contents, I can:

review what’s redundant

propose where each piece should live

generate a cleaned structure and a zip inside this sandbox

Suggested updated phase order (minimal disruption)

Phase 0.9: Agent runtime MVP + workflow graph + event streaming

Phase 1: blockers (env, prod secrets, frontend API URL)

Phase 1.5: onboarding CLI + channels registry + agent runtime selection

Phase 2: production hardening + SSL + prod doctor + cost controls

Phase 3: hybrid refactor (registry, orchestrator dispatch)

Phase 4: persistent learning agents (memory/RAG/personality)

This keeps your plan’s spirit but makes “agent-to-agent workflows” real early enough to matter.
---
Keeps Hybrid architecture intact

Makes agent-to-agent workflows real

Keeps everything pluggable

Prevents “AI UI fluff”

Enables community contribution

Protects you from cost explosions

Keeps it local-first but configurable
0. Strategic Positioning (Non-Technical but Critical)

Harbinger is:

A modular, local-first autonomous pentesting framework with pluggable agents, pluggable control surfaces, and observable multi-agent workflows.

Not:

❌ AI chatbot UI

❌ SaaS bug bounty marketplace

❌ “prompt → tool run” wrapper

❌ magic black box

It is:

✅ Agent runtime OS

✅ Tool orchestration engine

✅ Workflow graph execution layer

✅ Observability-first

✅ Contributor-friendly

This framing keeps contributors aligned.

🧠 New Section: Agent Runtime Standard (Must Exist Before Memory Phase)

Before persistence, you need a formal Agent Runtime Contract.

Add this to your plan.

Agent Runtime Interface (Standardized)

Every agent runtime (PentAGI adapter, Harbinger-native, future OpenClaw-like) must implement:

init(agent_config)

start_session(context)

plan(objective)

execute(step)

emit(event)

handoff(target_agent, artifact)

terminate(reason)

The orchestrator should never care how the agent thinks.

It only:

Dispatches events

Manages lifecycle

Stores outputs

Applies policy

This is how you prevent tight coupling.

🧬 Add: Agent Capability Matrix

You need a capability registry so users can:

Compare agents

Swap agents

Compose workflows

Example:

Agent	Recon	Exploit	Reporting	MCP Tools	Memory	Cost Mode
PentAGI Adapter	✅	⚠️	❌	✅	❌	High
Harbinger Native	✅	❌	✅	✅	❌	Medium
Future “RedTeam Agent”	✅	✅	⚠️	Custom	Planned	Variable

This supports your “agent to agent workflows” vision.

🧩 Add: Workflow Graph Engine (Critical for Agent-to-Agent)

Right now your plan talks about orchestration but not graph execution.

You need:

Workflow Node Types

Agent node

Tool node

Condition node

Approval node

Delay node

Handoff node

Graph Features

Directed edges

Execution state tracking

Partial failure handling

Retry logic

Parallel branches

Manual override

Without this, you can’t truly visualize agent-to-agent workflows.

👁 Observability Layer (No AI Bullshit UI)

Since you explicitly said:

i dont want no ai bull shit ui

Good. Then the UI must be:

Professional DevOps-style

Real-time event stream

Structured logs

Expandable tool calls

Artifact downloads

Timeline view

Graph view toggle

Execution diff view

Token/cost tracking panel

Resource usage panel

No fake “thinking bubbles.”
No “magical typing animations.”
Just professional runtime transparency.

💰 Add: Cost & Resource Governance Layer

This is mandatory if agents are autonomous.

Each job must have:

Max token budget

Max runtime

Max tool invocations

Max Docker resource allocation

Max concurrency

And:

Cost per job recorded

Agent efficiency metrics

Optimization suggestions

This protects your small team model.

🔌 Add: Plugin Development Kit (Community Ready)

If you want contributors, you must define:

Plugin Types

Tool Plugin

Agent Runtime Plugin

Channel Plugin

Workflow Template Pack

Report Template Pack

Each plugin must declare:

Metadata

Permissions required

Capabilities

Version compatibility

And be loaded from:

/plugins/
  /agents/
  /tools/
  /channels/
  /workflows/

That’s how this becomes ecosystem-ready.

🧠 Extend Phase 4: Agent Learning Architecture

When you move to persistence, structure it properly:

Memory Layers

Short-term (session)

Episodic (job summaries)

Semantic (embedding index)

Strategic (playbooks derived from wins)

Add:

Confidence scoring per strategy

Decay of stale strategies

Feedback weighting

That gives “growth” without chaos.

🔐 Add: Safety + Policy Enforcement Layer

Since this is pentesting/red team oriented:

Each agent must pass through:

Scope validator

Target authorization check

Rate limiter

Exploit policy filter

Tool safety filter

This prevents accidental overreach.

🧭 Add: Multi-Agent Coordination Model

Define coordination strategies:

Sequential pipeline

Supervisor model (1 master agent delegates)

Specialist swarm

Competitive agents (best result wins)

Consensus mode (multiple agents verify)

Let users pick coordination style per workflow.

That makes your system unique.

🏗 Architectural Enhancement Summary

You now have:

Orchestrator Core

Channel Registry

Agent Runtime Standard

Workflow Graph Engine

Observability Layer

Cost Governance

Plugin SDK

Memory System (future)

Policy Enforcement

Multi-Agent Coordination

That’s a real offensive automation framework.

What You’re Actually Building (and it’s strong)

Harbinger becomes:

A local-first, pluggable, autonomous offensive security operating system with visualized multi-agent workflow execution and persistent identity.

That’s powerful.
## 10. Definition of Done
Shot 1 (Phase 0.9 + Phase 1) — make it run + consistent

finalize production plan file (single source of truth)

fix compose env injection

fix frontend API URL build behavior

add production secret validation

ensure one API base path (/api/v1) and route inventory logging in dev

ensure one backend entrypoint used everywhere

Acceptance test:

docker compose up -d works

curl /api/v1/health works

setup wizard doesn’t require manual .env editing

Shot 2 (Phase 1.5) — “OpenClaw-style onboarding” done right

harbinger onboard

harbinger configure ...

doctor integration

channels selection wizard

registry file exists and UI respects enabled channels

Shot 3 (Phase 3) — hybrid refactor + plugin surfaces

registry-based channels

routes are adapters only

orchestrator is dispatch(event)

surfaces normalize input → event → dispatch

Shot 4 (Agent runtime MVP) — usable “agent-to-agent workflows”

add agent runtime interface

workflow graph engine

event streaming to UI

minimal PentAGI adapter (even if basic)

That will look and feel like a “big one-shot build,” but it’s realistically grouped.

“Read README.md, PROJECT_COMPLETION.md, all .md files in /docs, /setup, /backend, and any existing production plan docs. Treat the file below as the single source of truth and update it (do not create a competing plan). Then implement Phase 0.9 and Phase 1 only, and stop. Do not implement Phase 1.5+.

Rules:

Keep hybrid architecture: channels are pluggable; no hard-coded Telegram/Discord.

Setup must be wizard-driven: no documentation or primary path that says ‘edit .env manually.’

Enforce canonical API base path /api/v1 everywhere.

Ensure a single backend entrypoint is used by docker + dev.

Add dev-only route inventory logging (prints registered routes).

Create Phase 0.9 scaffolding: agent runtime interface + workflow graph schema + standardized event types; these can be stubbed but must compile.

Add config/channels.json and a registry loader.

Update docker-compose.yml to pass APP_URL and GITHUB_* to backend.

Create docker-compose.prod.yml for prod overrides.

Fix frontend Dockerfile so VITE_API_URL defaults to empty in production build.

Add production secret validation in backend startup: exit with clear error if defaults are present when APP_ENV=production.

Acceptance tests:

pnpm doctor succeeds locally (or prints actionable fixes).

docker compose up -d starts stack.

curl http://localhost/api/v1/health returns ok through nginx.

No missing setup endpoints referenced in docs; route paths consistent.

After changes:

Show a checklist of what was completed (Phase 0.9 + Phase 1) and what remains.

Update the plan checkboxes accordingly.”

Then paste your plan content below it (the big text you posted).

About “zip the extra @Harbinger folder”

Claude Code can do that if it’s actually in the repo:

It can identify redundant code

Move it into legacy/ or archive/

Generate a zip (e.g., archive/Harbinger-extra.zip)

But to do that safely, you should give it rules:

Never delete; only move to archive/ and include a README explaining why.
- [ ] Phase 1 blockers complete
- [ ] Phase 1.5 CLI onboarding complete (`onboard`, `configure`)
- [ ] `docker-compose up -d` runs all services
- [ ] Login works (GitHub OAuth or local)
- [ ] Dashboard loads, health dots reflect status
- [ ] No default secrets when APP_ENV=production
- [ ] HTTPS available (configurable)
- [ ] Setup wizard covers all config; no manual .env editing
- [ ] Channels (Telegram, etc.) optional and configurable
what MCP and MCP-UI are, and how you can run everything fully local with Ollama/LM Studio—yes, you absolutely can.

🔌 What is MCP (Model Context Protocol)?
Think of MCP as "USB-C for AI applications" . Just like USB-C standardizes how devices connect to peripherals, MCP standardizes how AI models connect to tools and data sources.

Core Concepts
Standardized Communication: MCP defines a common way for LLMs to discover and call tools, regardless of which provider (OpenAI, Anthropic, local) you're using .

JSON-RPC over multiple transports: Works over stdio (for local processes), HTTP/SSE, or WebSockets .

Client-Server Architecture:

MCP Client: The AI application (Claude Desktop, Cursor, your Harbinger UI)

MCP Server: Exposes tools, resources, and prompts to the AI 

Why It Matters for Harbinger
Instead of hard-coding tool integrations, you can:

Create MCP servers for each security tool category (network, web, binary, etc.)

Let your agents discover and call tools dynamically

Switch between local models (Ollama) and cloud models seamlessly

Add permission layers and audit trails at the MCP level 

🎨 What is MCP-UI?
MCP-UI extends the protocol to add rich, interactive interfaces to tool responses . Instead of getting plain text back from a tool, you get actual UI components rendered in your chat.

How It Works
Server returns UIResource alongside the normal text response :

typescript
{
  content: [
    { type: "text", text: "Upload successful!" },
    createUIResource({
      uri: "ui://preview/123",
      content: { 
        type: 'rawHtml', 
        htmlString: '<div>Preview here...</div>' 
      },
      encoding: 'text'
    })
  ]
}
Client renders it using <UIResourceRenderer /> (React or Web Component) 

UI can send actions back (tool calls, prompts, intents) via postMessage 

Content Types Supported 
Type	MIME Type	Use Case
Raw HTML	text/html	Self-contained UI rendered in iframe
External URL	text/uri-list	Embed existing web apps
Remote DOM	application/vnd.mcp-ui.remote-dom	Script-based UI that matches host look/feel
Real Examples
Cloudinary upload: Shows image preview + copy buttons + transformation options 

Filesystem explorer: Interactive file browser instead of text file lists 

✅ Can You Run This Fully Local with Ollama/LM Studio?
YES—100% local, no cloud APIs required. Here's exactly how:

1. Local LLM via MCP Bridge
There are ready-made MCP servers that connect to local models:

For Ollama :

bash
# agent-cascade MCP server
export LM_BASE_URL=http://localhost:11434/v1
export DEFAULT_MODEL=qwen2.5-coder

# In your MCP client config
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
For LM Studio :

bash
# LM Studio runs at http://localhost:1234/v1 by default
python3 universal_kali_client.py \
  --server http://your-kali-server:5000 \
  --provider local \
  --base-url http://localhost:1234/v1 \
  --model "your-model-name"
2. Local Tools via MCP
You can run all security tools locally and expose them via MCP:

Filesystem access :

json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/allowed/path/for/tools",
        "/another/allowed/path"
      ]
    }
  }
}
Custom Kali tools :

python
# Run kali_server.py on your Kali machine
python3 kali_server.py  # Exposes nmap, sqlmap, etc. via MCP

# Connect from your MCP client
{
  "mcpServers": {
    "kali_mcp": {
      "command": "python3",
      "args": [
        "/path/to/mcp_server.py",
        "--server",
        "http://192.168.1.100:5000/"
      ]
    }
  }
}
3. Create Your Own API Key System
Since everything is local, you control authentication entirely. Options:

Simple environment variables :

json
{
  "env": {
    "HARBINGER_API_KEY": "your-local-secret-key",
    "TOOL_AUTH_TOKEN": "another-token"
  }
}
Fine-grained permissions using MCP's auth system :

go
// In your Go MCP server
authService := auth.New( authorization.Policy{
  Tools: map[string]ToolPolicy{
    "nmap_scan": { Roles: ["pentester"] },
    "delete_file": { Roles: ["admin"] },
  }
})
OAuth2/OIDC support if you want SSO later 

4. MCP-UI Completely Local
The UI rendering happens entirely in the client—no cloud needed. You can:

Generate HTML previews of scan results

Show interactive network graphs

Render vulnerability reports with expandable sections

Build custom dashboards that send actions back to your agents 

🔧 Putting It All Together for Harbinger
Here's your fully local stack:

text
┌─────────────────────────────────────┐
│     MCP Client (Harbinger UI)       │
│  • React with <UIResourceRenderer/> │
│  • Runs in browser/Electron         │
└────────────┬────────────────────────┘
             │ JSON-RPC (stdio/HTTP)
┌────────────▼────────────────────────┐
│     MCP Orchestrator (Go)           │
│  • Routes to appropriate servers    │
│  • Enforces permissions             │
│  • Logs all actions                  │
└────────────┬────────────────────────┘
     ┌───────┼───────┬────────┐
     ▼       ▼       ▼        ▼
┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│ LLM MCP ││Tool MCP ││Tool MCP ││MCP-UI   │
│ Server  ││Server   ││Server   ││Renderer │
│(Ollama/ ││(nmap,   ││(sqlmap, ││(in UI)  │
│ LMStudio)││gobuster)││hydra)   ││         │
└─────────┘└─────────┘└─────────┘└─────────┘
     │           │         │           │
     ▼           ▼         ▼           ▼
  Local       Local     Local       Local
  Model       Tools     Tools       Browser
Implementation Steps for Harbinger
Create MCP servers for each tool category (or adapt existing ones)

Build MCP-UI components for rich visualization of results

Configure Ollama/LM Studio as your LLM provider

Set environment variables for your local API keys

Run everything in Docker for isolation

📊 Provider Comparison for Local Setup 
Provider	Cost	Speed	Function Calling	Best For
Ollama	Free	Fast	Model-dependent	Privacy, offline work
LM Studio	Free	Fast	Model-dependent	GUI, easy model switching
vLLM	Free	Very Fast	Good	High-performance local
Cloud (optional)	$$$	Fast	Excellent	When you need more power
🚀 Quick Start for Your Local Setup
bash
# 1. Run Ollama with a function-calling model
ollama run qwen2.5-coder:7b

# 2. Set up agent-cascade MCP server
git clone https://github.com/BlinkZer0/Agent-Cascade
cd Agent-Cascade
npm install
npm run build

# 3. Configure your MCP client (Cursor/Claude Desktop)
# Add to config:
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["/path/to/Agent-Cascade/dist/server.js"],
      "env": {
        "LM_BASE_URL": "http://localhost:11434/v1",
        "DEFAULT_MODEL": "qwen2.5-coder"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    }
  }
}

# 4. Start building your own MCP-UI components
npm install @mcp-ui/server @mcp-ui/client
Bottom line: You have complete control—local models, local tools, local API keys, and beautiful MCP-UI interfaces. No cloud dependencies, no API costs, full privacy. This is exactly what Harbinger needs 🔥
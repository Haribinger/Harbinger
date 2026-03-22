# Harbinger v2.0 — Phase 3–6 All-Terminals Implementation Plan

**Date:** 2026-03-22
**Spec:** `docs/superpowers/specs/2026-03-22-harbinger-v2-autonomous-os-design.md`
**Status:** Active — multi-terminal parallel execution

---

## Terminal Assignments

| Terminal | Role | Owner Phases | Primary Deliverables |
|----------|------|-------------|---------------------|
| **T1** | Mission Control | 3, 7 | CLI commands, mission lifecycle, approval gates, kill switch |
| **T2** | Agent Watch | 3, 4 | Agent delegation, specialist prompts, ReAct performer, live streaming |
| **T3** | Findings Feed | 4, 6 | Real-time findings SSE, severity routing, export, report generation |
| **T4** | War Room | 3, 7 | TUI dashboard, task DAG viz, file locks, command injection, warroom API |
| **T5** | Agent Shell | 3, 4 | Docker agent images, container spawning, exec tool, shell attachment |
| **T6** | Memory | 4, 6 | Knowledge graph, pgvector, memory layers, summarization, memory CLI |
| **T7** | Healing | 5, 6 | Self-healing monitor, LLM diagnosis, stall detection, observability |

---

## What's Already Built (as of 2026-03-22)

### Phase 0+1: FastAPI Sidecar + Execution Engine ✅

| Component | Location | Status |
|-----------|----------|--------|
| FastAPI skeleton | `prowlrbot-engine/` | ✅ Running on :8000 |
| Health routes | `prowlrbot-engine/src/routers/health.py` | ✅ |
| Auth bridge (JWT) | `prowlrbot-engine/src/auth.py` | ✅ |
| DB connection (asyncpg) | `prowlrbot-engine/src/db.py` | ✅ |
| Config | `prowlrbot-engine/src/config.py` | ✅ |
| Docker client | `prowlrbot-engine/src/docker/client.py` | ✅ |
| Mission router | `prowlrbot-engine/src/routers/missions.py` | ✅ |
| Tool registry | `prowlrbot-engine/src/engine/tools/registry.py` | ✅ |
| Terminal tool | `prowlrbot-engine/src/engine/tools/terminal.py` | ✅ |
| File tool | `prowlrbot-engine/src/engine/tools/file_tool.py` | ✅ |
| Barrier tools | `prowlrbot-engine/src/engine/tools/barriers.py` | ✅ |
| Execution monitor | `prowlrbot-engine/src/engine/monitor.py` | ✅ |
| Summarizer (Python) | `prowlrbot-engine/src/engine/summarizer.py` | ✅ |
| Executor | `prowlrbot-engine/src/engine/executor.py` | ✅ |
| Performer (ReAct) | `prowlrbot-engine/src/engine/performer.py` | ✅ |
| Nginx routing | `docker/nginx/nginx.conf` | ✅ `/api/v2/*` → FastAPI |
| docker-compose | `docker-compose.yml` | ✅ backend-py service |

### Phase 2: ROAR Protocol + Channels ✅

| Component | Location | Status |
|-----------|----------|--------|
| ROAR identity | `backend/pkg/roar/identity.go` | ✅ |
| ROAR message bus | `backend/pkg/roar/bus.go` | ✅ |
| ROAR discovery | `backend/pkg/roar/discovery.go` | ✅ |
| ROAR SSE stream | `backend/pkg/roar/stream.go` | ✅ |
| Channel manager | `backend/pkg/channels/manager.go` | ✅ |
| Channel adapters | `backend/pkg/channels/{slack,discord,telegram}.go` | ✅ |
| Pipeline engine | `backend/pkg/pipeline/pipeline.go` | ✅ |

### Phase 3 (Partial): Memory & Knowledge Graph — T6

| Component | Location | Status |
|-----------|----------|--------|
| Neo4j client + schema + queries | `backend/pkg/neo4jclient/` | ✅ |
| Embedder (OpenAI + Noop) | `backend/pkg/embedder/` | ✅ 14 tests |
| L1 Redis working memory | `backend/pkg/memorylayer/working.go` | ✅ 7 tests |
| Summarizer (Go) | `backend/pkg/memorylayer/summarizer.go` | ✅ 8 tests |
| Graph HTTP handlers | `backend/cmd/knowledgegraph.go` | ✅ 10 handlers |
| Memory layer handlers | `backend/cmd/memorylayer.go` | ✅ 9 handlers |
| main.go wiring | `backend/cmd/main.go` | ✅ 38 new routes |
| Frontend API clients | `src/api/{knowledgeGraph,memoryLayer}.ts` | ✅ |
| Frontend stores | `src/store/{knowledgeGraph,memoryLayer}Store.ts` | ✅ |

### Other Terminals (Partial)

| Component | Location | Terminal | Status |
|-----------|----------|---------|--------|
| Agent delegation tools | `prowlrbot-engine/src/engine/tools/delegation.py` | T2 | ✅ |
| Agent prompts (9 agents) | `prowlrbot-engine/src/agents/prompts/*.md` | T2 | ✅ |
| LLM adapter | `prowlrbot-engine/src/agents/llm.py` | T2 | ✅ |
| Agent shell handlers | `backend/cmd/agentshell.go` | T5 | ✅ |
| Agent shell frontend | `src/{api,store,pages}/agentshell*` | T5 | ✅ |
| Findings handlers | `backend/cmd/findings.go` | T3 | ✅ |
| Findings frontend | `src/{api,store,pages}/findings*` | T3 | ✅ |
| Healing monitor | `backend/cmd/healing.go` | T7 | ✅ |
| Healing frontend | `src/{api,store}/healing*` | T7 | ✅ |
| War Room router | `prowlrbot-engine/src/routers/warroom.py` | T4 | ✅ |
| War Room engine | `prowlrbot-engine/src/warroom/` | T4 | ✅ |
| Realtime V2 | `backend/cmd/realtime.go` (modified) | T1 | ✅ |

---

## Phase 3: Agent Delegation + Specialist Execution (Remaining)

> **Spec ref:** § 2 (Real Agent Delegation) + § 3 (Parallel Execution Engine)
> **Duration:** ~1 week remaining

### T1: Mission Control — CLI + Lifecycle

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T1-3.1** | Mission CLI — `harbinger mission start "pentest example.com"` | `prowlrbot-engine/src/cli/mission.py` | 1d |
| **T1-3.2** | Mission planner — ORCHESTRATOR decomposes request into Task DAG | `prowlrbot-engine/src/engine/planner.py` | 2d |
| **T1-3.3** | DAG scheduler — topo sort, parallel launch, dep tracking | `prowlrbot-engine/src/engine/scheduler.py` | 2d |
| **T1-3.4** | Approval gates — pause/notify/resume on `approval_required` | `prowlrbot-engine/src/engine/approval.py` | 1d |
| **T1-3.5** | Kill switch — global halt, propagate to all containers | `prowlrbot-engine/src/engine/killswitch.py` | 0.5d |
| **T1-3.6** | Mission types — template DAGs (pentest, bounty, redteam, audit, continuous) | `prowlrbot-engine/src/engine/templates/` | 1d |

**Dependencies:** T5 (container spawning), T2 (performer)

### T2: Agent Watch — Delegation + Streaming

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T2-3.1** | Agent config registry — tools, models, docker images, iteration limits | `prowlrbot-engine/src/agents/config.py` | 0.5d |
| **T2-3.2** | Specialist spawning — sub-agent chains with limited iterations | `prowlrbot-engine/src/agents/spawner.py` | 1d |
| **T2-3.3** | Execution monitor integration — loop detection + adviser in performer | Modify `performer.py` | 1d |
| **T2-3.4** | Agent activity SSE — stream tool calls, stdout, status | `prowlrbot-engine/src/routers/agents_v2.py` | 1d |
| **T2-3.5** | Agent watch CLI — `harbinger agents watch [--agent BREACH]` | `prowlrbot-engine/src/cli/agents.py` | 0.5d |
| **T2-3.6** | Reflector — near-limit graceful shutdown, no-action intervention | Modify `performer.py` | 0.5d |

**Dependencies:** T5 (containers), T6 (memory tools)

### T4: War Room — TUI Dashboard

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T4-3.1** | War Room SSE — task graph updates, agent status, file locks | Modify `warroom.py` | 1d |
| **T4-3.2** | Command injection — send commands to running agents | `prowlrbot-engine/src/warroom/commands.py` | 1d |
| **T4-3.3** | Task reassignment — move tasks between agents | `prowlrbot-engine/src/warroom/reassign.py` | 0.5d |
| **T4-3.4** | War Room frontend — task graph (React Flow), agent tiles | `src/pages/WarRoom/WarRoom.tsx` | 2d |
| **T4-3.5** | War Room CLI — `harbinger warroom --mission 123` | `prowlrbot-engine/src/cli/warroom.py` | 0.5d |

**Dependencies:** T1 (mission IDs), T2 (agent status)

### T5: Agent Shell — Docker Images + Spawning

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T5-3.1** | Agent Docker images — pd-tools, kali-tools, dev-tools, osint-tools, base | `docker/agent-images/` | 1d |
| **T5-3.2** | Container spawning — isolated workspace per task | `prowlrbot-engine/src/docker/spawner.py` | 1d |
| **T5-3.3** | Container networking — shared mission network, default no-internet | `prowlrbot-engine/src/docker/networking.py` | 0.5d |
| **T5-3.4** | Shell attachment (**done**) | `backend/cmd/agentshell.go` | ✅ |
| **T5-3.5** | Container cleanup — auto-remove, evidence volume preservation | `prowlrbot-engine/src/docker/cleanup.py` | 0.5d |

**Dependencies:** None (can start immediately)

---

## Phase 4: Tool Layer (Search, Browser, Memory, Graph)

> **Spec ref:** § 4 (Real Tool Execution Layer)
> **Duration:** ~1 week

### T2: Search Engine + Browser Tools

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T2-4.1** | Search abstraction — unified interface for all engines | `prowlrbot-engine/src/engine/tools/search.py` | 1d |
| **T2-4.2** | Google Custom Search | `prowlrbot-engine/src/engine/tools/search_google.py` | 0.5d |
| **T2-4.3** | DuckDuckGo + SearXNG | `prowlrbot-engine/src/engine/tools/search_ddg.py` | 0.5d |
| **T2-4.4** | Tavily + Perplexity | `prowlrbot-engine/src/engine/tools/search_ai.py` | 0.5d |
| **T2-4.5** | Sploitus exploit search | `prowlrbot-engine/src/engine/tools/search_sploitus.py` | 0.5d |
| **T2-4.6** | Headless browser (CDP) | `prowlrbot-engine/src/engine/tools/browser.py` | 1d |

### T6: Memory + Graph Tools (Agent-Facing)

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T6-4.1** | `search_in_memory` — semantic search across L3 | `prowlrbot-engine/src/engine/tools/memory.py` | 0.5d |
| **T6-4.2** | `store_guide` / `search_guide` — anonymized technique guides | Same file | 0.5d |
| **T6-4.3** | `store_answer` / `search_answer` — Q&A from past missions | Same file | 0.5d |
| **T6-4.4** | `store_code` / `search_code` — code samples | Same file | 0.5d |
| **T6-4.5** | `graphiti_search` — graph temporal queries | `prowlrbot-engine/src/engine/tools/graph.py` | 1d |
| **T6-4.6** | pgvector semantic search upgrade | Modify `backend/pkg/vectormem/store.go` | 1d |
| **T6-4.7** | L2 Mission Memory — cross-agent findings + embeddings | `backend/pkg/memorylayer/mission.go` | 1d |
| **T6-4.8** | L5 Agent Identity — persistent learned patterns | `backend/pkg/memorylayer/identity.go` | 0.5d |
| **T6-4.9** | Scan → Graph ingestion (subfinder/httpx/nuclei parsers) | Modify `backend/cmd/knowledgegraph.go` | 1d |
| **T6-4.10** | Memory CLI — `harbinger memory search "apache struts"` | `prowlrbot-engine/src/cli/memory.py` | 0.5d |

### T3: Findings Integration

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T3-4.1** | Findings SSE stream — real-time push as vulns discovered | Modify `backend/cmd/findings.go` | 1d |
| **T3-4.2** | Findings → Graph pipeline — auto-ingest into Neo4j | Bridge findings.go ↔ knowledgegraph.go | 0.5d |
| **T3-4.3** | False positive marking — operator marks FP, feeds to learning | Modify `backend/cmd/findings.go` | 0.5d |
| **T3-4.4** | Findings export — markdown, JSON, CSV | Add export handlers to findings.go | 0.5d |
| **T3-4.5** | Findings CLI — `harbinger findings stream --mission 123` | `prowlrbot-engine/src/cli/findings.py` | 0.5d |

### T5: Subtask Management Tools

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T5-4.1** | `subtask_list` — agent generates subtask list | `prowlrbot-engine/src/engine/tools/subtasks.py` | 0.5d |
| **T5-4.2** | `subtask_patch` — agent modifies own subtasks | Same file | 0.5d |
| **T5-4.3** | `report_result` — structured report to operator | Same file | 0.5d |

---

## Phase 5: Self-Healing System

> **Spec ref:** § 5 (Self-Healing System)
> **Duration:** ~3 days

### T7: Healing Monitor

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T7-5.1** | Container health loop — check every 15s | `prowlrbot-engine/src/engine/healing.py` | 1d |
| **T7-5.2** | Subtask timeout — >10min = intervention | Same file | 0.5d |
| **T7-5.3** | Agent stall — >120s no action = inject prompt | Same file | 0.5d |
| **T7-5.4** | LLM diagnosis — logs → LLM → fix recommendation | `prowlrbot-engine/src/engine/healing_llm.py` | 1d |
| **T7-5.5** | Auto-heal — restart, memory increase, kill stalled exec | Same file | 0.5d |
| **T7-5.6** | Healing SSE — stream events to T7 terminal | `prowlrbot-engine/src/routers/healing_v2.py` | 0.5d |
| **T7-5.7** | Healing CLI — `harbinger healing watch` | `prowlrbot-engine/src/cli/healing.py` | 0.5d |

**Dependencies:** T5 (containers to monitor), T1 (mission context)

---

## Phase 6: Observability + Frontend Wiring

> **Spec ref:** § 7 (Observability), Phase 7-8
> **Duration:** ~1.5 weeks

### T7: Observability

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T7-6.1** | Trace system — mission→task→subtask→tool spans | `prowlrbot-engine/src/observability/traces.py` | 1d |
| **T7-6.2** | Token usage tracking — per-agent, per-mission cost | `prowlrbot-engine/src/observability/tokens.py` | 0.5d |
| **T7-6.3** | Langfuse integration (optional export) | `prowlrbot-engine/src/observability/langfuse.py` | 1d |
| **T7-6.4** | Observability dashboard API | `prowlrbot-engine/src/routers/observability_v2.py` | 0.5d |

### T6: Knowledge Graph + Memory Frontend

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T6-6.1** | Knowledge Graph page — React Flow graph viz | `src/pages/KnowledgeGraph/KnowledgeGraph.tsx` | 2d |
| **T6-6.2** | Memory search tab in graph page — unified search + layer filters | Same page | 1d |
| **T6-6.3** | Agent memory panel — L3/L5 per agent in Agents page | Modify `src/pages/Agents/Agents.tsx` | 0.5d |

### T3: Findings Feed Frontend

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T3-6.1** | Findings Feed page — SSE stream, severity colors, filters | `src/pages/FindingsFeed/FindingsFeed.tsx` | 1.5d |
| **T3-6.2** | Findings export UI — download md/JSON/CSV | Same page | 0.5d |
| **T3-6.3** | Findings → Report bridge — send to SCRIBE for report gen | API integration | 0.5d |

### T1: Mission Control Frontend

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T1-6.1** | Mission dashboard — create, DAG viz, status monitoring | `src/pages/MissionControl/MissionControl.tsx` | 2d |
| **T1-6.2** | Approval gate UI — approve/deny pending tasks | Same page | 0.5d |
| **T1-6.3** | Kill switch UI — emergency halt with confirmation | Same page | 0.5d |
| **T1-6.4** | Mission types selector — template picker | Same page | 0.5d |

### T4: War Room Frontend

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T4-6.1** | War Room page — task graph (React Flow), agent tiles | `src/pages/WarRoom/WarRoom.tsx` | 2d |
| **T4-6.2** | Command injection panel | Same page | 0.5d |
| **T4-6.3** | Shared context viewer | Same page | 0.5d |

### T5: Agent Shell Frontend

| Task | Description | Files | Effort |
|------|------------|-------|--------|
| **T5-6.1** | Agent Shell polish — xterm.js, container selector | `src/pages/AgentShell/AgentShell.tsx` | 1d |
| **T5-6.2** | Container status indicators | Same page | 0.5d |

---

## Cross-Terminal Dependency DAG

```
Phase 3:
  T5-3.1 (Docker images)           ──────────────────────┐
  T5-3.2 (Container spawning)      ─────────────────┐    │
                                                     │    │
  T2-3.1 (Agent config)            ─┐               │    │
  T2-3.2 (Specialist spawning)     ─┤── T2-3.3 ─────┤    │
  T2-3.6 (Reflector)               ─┘   (Monitor)   │    │
                                                     │    │
  T1-3.2 (Planner)                 ─┐               │    │
  T1-3.3 (Scheduler) ───────────────┤── depends on ─┘    │
  T1-3.4 (Approval)               ─┘    T5+T2            │
  T1-3.5 (Kill switch)            ─── depends on T5 ─────┘

  T4-3.* (War Room)               ─── depends on T1+T2

Phase 4:
  T6-4.6 (pgvector)               ─── independent
  T6-4.1..5 (memory tools)        ─── after T6-4.6
  T6-4.7 (L2 mission mem)         ─── after T1 mission IDs
  T6-4.9 (scan ingestion)         ─── after T3 findings format
  T2-4.* (search tools)           ─── independent
  T3-4.1 (findings SSE)           ─── after T2 agent tools
  T5-4.* (subtask tools)          ─── independent

Phase 5:
  T7-5.* (healing)                ─── after T5 containers

Phase 6:
  All frontend                    ─── after respective backend APIs
```

---

## Execution Waves (Optimal Parallelism)

### Wave 1 — No dependencies, start now

| Terminal | Tasks | What |
|----------|-------|------|
| **T5** | T5-3.1, T5-3.2, T5-3.3, T5-3.5 | Docker images + spawning |
| **T2** | T2-3.1 | Agent config registry |
| **T6** | T6-4.6 | pgvector semantic search |

### Wave 2 — After containers + config ready

| Terminal | Tasks | What |
|----------|-------|------|
| **T2** | T2-3.2, T2-3.3, T2-3.6 | Spawning + monitor + reflector |
| **T1** | T1-3.2, T1-3.3 | Planner + scheduler |
| **T6** | T6-4.1..T6-4.5 | Memory/graph tools |
| **T3** | T3-4.1 | Findings SSE |

### Wave 3 — After scheduler + delegation work

| Terminal | Tasks | What |
|----------|-------|------|
| **T1** | T1-3.1, T1-3.4, T1-3.5, T1-3.6 | CLI, gates, kill, templates |
| **T2** | T2-4.1..T2-4.6 | Search + browser tools |
| **T4** | T4-3.1..T4-3.5 | War Room backend |
| **T6** | T6-4.7..T6-4.10 | L2, L5, ingestion, CLI |
| **T5** | T5-4.1..T5-4.3 | Subtask tools |

### Wave 4 — Phase 5 (healing needs running containers)

| Terminal | Tasks | What |
|----------|-------|------|
| **T7** | T7-5.1..T7-5.7 | Self-healing (all) |
| **T3** | T3-4.2..T3-4.5 | Graph ingest, FP, export, CLI |

### Wave 5 — Phase 6 frontend (all 7 terminals parallel)

| Terminal | Tasks | What |
|----------|-------|------|
| **T1** | T1-6.1..T1-6.4 | Mission Control page |
| **T2** | T2-3.4, T2-3.5 | Agent watch SSE + CLI |
| **T3** | T3-6.1..T3-6.3 | Findings Feed page |
| **T4** | T4-6.1..T4-6.3 | War Room page |
| **T5** | T5-6.1..T5-6.2 | Agent Shell polish |
| **T6** | T6-6.1..T6-6.3 | Knowledge Graph page |
| **T7** | T7-6.1..T7-6.4 | Observability system |

---

## File Ownership (Conflict Prevention)

Each terminal owns specific files. **Never touch another terminal's files without coordination.**

### T1 — Mission Control
```
prowlrbot-engine/src/cli/mission.py
prowlrbot-engine/src/engine/planner.py
prowlrbot-engine/src/engine/scheduler.py
prowlrbot-engine/src/engine/approval.py
prowlrbot-engine/src/engine/killswitch.py
prowlrbot-engine/src/engine/templates/
src/pages/MissionControl/
src/api/missions.ts
src/store/missionStore.ts
```

### T2 — Agent Watch
```
prowlrbot-engine/src/agents/config.py
prowlrbot-engine/src/agents/spawner.py
prowlrbot-engine/src/agents/prompts/*.md        (own)
prowlrbot-engine/src/agents/llm.py              (own)
prowlrbot-engine/src/engine/performer.py        (own)
prowlrbot-engine/src/engine/tools/delegation.py (own)
prowlrbot-engine/src/engine/tools/search*.py
prowlrbot-engine/src/engine/tools/browser.py
prowlrbot-engine/src/routers/agents_v2.py
prowlrbot-engine/src/cli/agents.py
```

### T3 — Findings Feed
```
backend/cmd/findings.go                          (own)
src/api/findings.ts                              (own)
src/store/findingsStore.ts                       (own)
src/pages/FindingsFeed/                          (own)
prowlrbot-engine/src/cli/findings.py
```

### T4 — War Room
```
prowlrbot-engine/src/routers/warroom.py          (own)
prowlrbot-engine/src/warroom/                    (own)
prowlrbot-engine/src/warroom/commands.py
prowlrbot-engine/src/warroom/reassign.py
prowlrbot-engine/src/cli/warroom.py
src/pages/WarRoom/
src/api/warroom.ts
src/store/warroomStore.ts
```

### T5 — Agent Shell
```
backend/cmd/agentshell.go                        (own)
docker/agent-images/
prowlrbot-engine/src/docker/spawner.py
prowlrbot-engine/src/docker/networking.py
prowlrbot-engine/src/docker/cleanup.py
prowlrbot-engine/src/engine/tools/subtasks.py
src/api/agentshell.ts                            (own)
src/store/agentShellStore.ts                     (own)
src/pages/AgentShell/                            (own)
```

### T6 — Memory & Knowledge Graph
```
backend/pkg/neo4jclient/                         (own)
backend/pkg/embedder/                            (own)
backend/pkg/memorylayer/                         (own)
backend/pkg/vectormem/store.go                   (own)
backend/cmd/knowledgegraph.go                    (own)
backend/cmd/memorylayer.go                       (own)
backend/cmd/vectormem.go                         (own)
prowlrbot-engine/src/engine/tools/memory.py
prowlrbot-engine/src/engine/tools/graph.py
prowlrbot-engine/src/cli/memory.py
src/api/{knowledgeGraph,memoryLayer}.ts          (own)
src/store/{knowledgeGraph,memoryLayer}Store.ts   (own)
src/pages/KnowledgeGraph/
```

### T7 — Healing + Observability
```
backend/cmd/healing.go                           (own)
prowlrbot-engine/src/engine/healing.py
prowlrbot-engine/src/engine/healing_llm.py
prowlrbot-engine/src/routers/healing_v2.py
prowlrbot-engine/src/observability/
prowlrbot-engine/src/routers/observability_v2.py
prowlrbot-engine/src/cli/healing.py
src/api/healing.ts                               (own)
src/store/healingStore.ts                        (own)
```

### Shared Files (APPEND ONLY — coordinate)
```
backend/cmd/main.go              → route registration, append at end of section
prowlrbot-engine/src/main.py     → router imports, append
docker-compose.yml               → service additions
docker/nginx/nginx.conf          → location blocks
src/App.tsx                      → lazy route additions
src/components/Layout/Sidebar.tsx → nav entries
src/api/index.ts                 → export additions
```

---

## Verification Checkpoints

### Phase 3 Done When:
- [ ] `harbinger mission start "pentest example.com"` creates DAG
- [ ] Tasks auto-launch in parallel when deps satisfied
- [ ] Agents delegate to specialists via tool calls
- [ ] War Room SSE shows live task graph
- [ ] Kill switch halts all containers within 5s
- [ ] `go build -o /tmp/harbinger-backend ./cmd/` clean
- [ ] `pnpm build:ui` clean
- [ ] `cd prowlrbot-engine && python -m pytest` all pass

### Phase 4 Done When:
- [ ] Agents search Google/DDG/Tavily/Sploitus in ReAct loop
- [ ] `search_in_memory` returns semantically relevant results
- [ ] `store_guide` → another agent finds it with `search_guide`
- [ ] Findings auto-ingest into Neo4j
- [ ] `harbinger memory search "apache struts"` returns results
- [ ] Memory dashboard shows all 5 layers with real stats

### Phase 5 Done When:
- [ ] Container crash → auto-restart within 30s
- [ ] Subtask timeout >10min → kill + notify
- [ ] Agent stall >120s → inject prompt
- [ ] LLM diagnosis explains failure in healing log
- [ ] `harbinger healing watch` streams events

### Phase 6 Done When:
- [ ] Mission Control page creates + monitors missions
- [ ] Findings Feed shows real-time stream with severity colors
- [ ] War Room renders task graph + command injection
- [ ] Knowledge Graph visualizes nodes with React Flow
- [ ] Agent Shell provides working terminal
- [ ] Observability traces visible per-mission with costs

---

## CLI Commands (Full)

```
harbinger mission start "pentest example.com"       T1: Create mission
harbinger mission status 123                         T1: Show progress
harbinger mission pause/resume/kill 123              T1: Lifecycle control

harbinger agents watch [--agent BREACH]              T2: Live activity stream
harbinger agents list                                T2: Active agents

harbinger findings stream --mission 123              T3: Real-time findings
harbinger findings export --mission 123 --format md  T3: Export

harbinger warroom --mission 123                      T4: TUI dashboard
harbinger warroom inject BREACH "run nuclei"         T4: Command injection

harbinger agent attach PATHFINDER                    T5: Container shell
harbinger agent logs PATHFINDER                      T5: Container logs

harbinger memory search "apache struts"              T6: Cross-layer search
harbinger memory graph "10.0.0.1"                    T6: Graph neighbors

harbinger healing watch                              T7: Healing events
harbinger healing stats                              T7: Healing summary
```

---

## Timeline

| Phase | Duration | Critical Path |
|-------|----------|---------------|
| Phase 3 (remaining) | 1 week | T5→T2→T1 (containers→delegation→scheduler) |
| Phase 4 | 1 week | T6 tools + T2 search (parallel) |
| Phase 5 | 3 days | T7 (after containers) |
| Phase 6 | 1.5 weeks | All 7 terminals parallel |
| **Total** | **~4 weeks** | With full parallel execution |

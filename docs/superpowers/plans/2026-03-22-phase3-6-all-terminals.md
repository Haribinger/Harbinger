# Harbinger v2.0 Phases 3-6: All Terminals Parallel Execution

> **Terminal assignments for parallel execution. Each terminal works independently.**

---

## T1 (Mission Control): Phase 5 — Self-Healing + Phase 6 — Observability

### T1 Task 1: Self-Healing Monitor
- Create `prowlrbot-engine/src/healing/monitor.py`
- Health check loop: container health, subtask timeout, agent stall detection
- LLM-powered failure diagnosis
- Selective restart (container only, not whole mission)

### T1 Task 2: Healing API
- Create `prowlrbot-engine/src/routers/healing.py`
- `GET /api/v2/healing/status` — active interventions
- `GET /api/v2/healing/events` — healing event log
- `POST /api/v2/healing/restart/{task_id}` — manual restart

### T1 Task 3: Langfuse Integration
- Create `prowlrbot-engine/src/observability/langfuse.py`
- Trace per mission, span per task, tool observations
- Token usage tracking, cost estimation

### T1 Task 4: Metrics + SSE Events
- Create `prowlrbot-engine/src/observability/metrics.py`
- `GET /api/v2/missions/{id}/metrics` — real-time metrics
- `GET /api/v2/missions/{id}/events` — SSE event stream

---

## T2 (Agent Worker): Phase 3 — Docker Agent Images

### T2 Task 1: pd-tools Dockerfile
- Create `docker/pd-tools/Dockerfile`
- Install: nuclei, subfinder, httpx, katana, naabu, interactsh, cvemap, uncover
- Multi-stage Go build + slim runtime
- `docker build -t harbinger/pd-tools:latest docker/pd-tools/`

### T2 Task 2: kali-tools Dockerfile
- Create `docker/kali-tools/Dockerfile`
- Install: sqlmap, dalfox, ffuf, gobuster, nmap, masscan, nikto
- FROM kalilinux/kali-rolling

### T2 Task 3: dev-tools Dockerfile
- Create `docker/dev-tools/Dockerfile`
- Install: semgrep, python3, node, go, git + copy mockhunter
- FROM python:3.12-slim

### T2 Task 4: osint-tools + base Dockerfiles
- Create `docker/osint-tools/Dockerfile` (theHarvester, Sherlock, SpiderFoot)
- Create `docker/base/Dockerfile` (curl, jq, git, python3)

### T2 Task 5: Build and verify all images
- Build all 5 images
- Run smoke test in each: `docker run --rm harbinger/pd-tools nuclei -version`

---

## T3 (Agent Worker): Phase 4 — Memory + Knowledge Graph

### T3 Task 1: pgvector Memory Store
- Create `prowlrbot-engine/src/memory/store.py`
- `search(queries, collection, filters, limit, threshold)` — semantic search
- `store(content, collection, metadata)` — embed + store
- Uses asyncpg + pgvector extension

### T3 Task 2: Memory Tools
- Create `prowlrbot-engine/src/engine/tools/memory_tools.py`
- search_in_memory, search_guide, store_guide, search_answer, store_answer, search_code, store_code
- Wire into tool registry

### T3 Task 3: Neo4j Knowledge Graph
- Create `prowlrbot-engine/src/memory/graph.py`
- Cypher queries: hosts, services, vulns, techniques, credentials
- `store_execution(agent, tool_call, result)` — after each tool call
- `search_graph(query, search_type)` — graphiti_search tool

### T3 Task 4: Memory Router
- Create `prowlrbot-engine/src/routers/memory.py`
- `GET /api/v2/memory/search` — semantic search
- `GET /api/v2/memory/graph` — knowledge graph query
- `POST /api/v2/memory/store` — manual memory entry

---

## T4 (War Room): Phase 7 — Frontend Wiring

### T4 Task 1: Mission Store + API Module
- Create `harbinger-tools/frontend/src/api/missions.ts`
- Create `harbinger-tools/frontend/src/store/missionStore.ts`
- CRUD + execute + status polling

### T4 Task 2: Task Graph Component
- Create `harbinger-tools/frontend/src/pages/MissionControl/TaskGraph.tsx`
- @xyflow/react DAG visualization
- Nodes = tasks, edges = dependencies
- Color by status: gray→gold→green→red

### T4 Task 3: Mission Control Page
- Create `harbinger-tools/frontend/src/pages/MissionControl/MissionControl.tsx`
- Three-panel layout: task graph (center), agent status (left), findings feed (right)
- SSE subscription for real-time updates

### T4 Task 4: Terminal Stream Component
- Create `harbinger-tools/frontend/src/components/TerminalStream.tsx`
- Live stdout/stderr from agent containers via SSE
- Tab per agent, ANSI color support

### T4 Task 5: Wire Routes + Sidebar
- Add `/mission-control` route to App.tsx
- Add MissionControl to Sidebar
- Lazy-load the page component

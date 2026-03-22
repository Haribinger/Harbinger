# Harbinger v2.0 — Autonomous Security Operating System

**Date:** 2026-03-22
**Status:** Design Complete — Awaiting Implementation Plan
**Scope:** Full platform: execution engine, parallel orchestration, real agent delegation, tool layer, self-healing, observability, memory, multi-agent coordination

---

## 1. EXECUTION ENGINE (Core — PentAGI Pattern)

### 1.1 Hierarchy: Mission → Task → SubTask → Action

```
Mission (user request)
  └→ Task (assigned to agent, runs in Docker container)
       └→ SubTask (LLM-generated step, executed via ReAct loop)
            └→ Action (individual tool call: terminal, search, memory, etc.)
```

**Statuses:** `created → running → waiting → finished → failed`

### 1.2 Database Schema

```sql
CREATE TYPE mission_status AS ENUM ('created','planning','running','waiting','paused','finished','failed','cancelled');
CREATE TYPE task_status AS ENUM ('created','queued','running','waiting','finished','failed','skipped');
CREATE TYPE subtask_status AS ENUM ('created','running','waiting','finished','failed');
CREATE TYPE action_status AS ENUM ('received','running','finished','failed');

CREATE TABLE missions (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status mission_status NOT NULL DEFAULT 'created',
    mission_type TEXT NOT NULL DEFAULT 'custom',
    target TEXT,
    scope JSONB,
    autonomy_level TEXT DEFAULT 'supervised',
    trace_id TEXT,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    mission_id BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'created',
    agent_codename TEXT NOT NULL,
    docker_image TEXT DEFAULT 'harbinger/base:latest',
    container_id TEXT,
    depends_on BIGINT[] DEFAULT '{}',
    approval_required BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    input TEXT,
    result TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subtasks (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status subtask_status NOT NULL DEFAULT 'created',
    result TEXT,
    context TEXT,
    msg_chain_id BIGINT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE actions (
    id BIGSERIAL PRIMARY KEY,
    subtask_id BIGINT NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
    call_id TEXT,
    tool_name TEXT NOT NULL,
    args JSONB NOT NULL,
    result TEXT,
    result_format TEXT DEFAULT 'markdown',
    status action_status NOT NULL DEFAULT 'received',
    duration_seconds FLOAT,
    mission_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE msg_chains (
    id BIGSERIAL PRIMARY KEY,
    chain_type TEXT NOT NULL,
    model TEXT,
    provider TEXT,
    tokens_in BIGINT DEFAULT 0,
    tokens_out BIGINT DEFAULT 0,
    chain JSONB,
    mission_id BIGINT NOT NULL,
    task_id BIGINT,
    subtask_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE terminal_logs (
    id BIGSERIAL PRIMARY KEY,
    stream TEXT NOT NULL,
    content TEXT NOT NULL,
    container_id TEXT NOT NULL,
    mission_id BIGINT NOT NULL,
    task_id BIGINT,
    subtask_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE memory_store (
    id BIGSERIAL PRIMARY KEY,
    collection TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_mission ON tasks(mission_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_actions_subtask ON actions(subtask_id);
CREATE INDEX idx_actions_mission ON actions(mission_id);
CREATE INDEX idx_terminal_logs_container ON terminal_logs(container_id);
CREATE INDEX idx_memory_embedding ON memory_store USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memory_collection ON memory_store(collection);
CREATE INDEX idx_memory_metadata ON memory_store USING gin (metadata);
```

### 1.3 Mission Lifecycle

```
User Request
    |
    v
PLANNER (ORCHESTRATOR agent)
    - Decomposes request into Task DAG
    - Assigns agent + docker image per task
    - Sets dependencies (depends_on[])
    - Sets approval gates
    |
    v
SCHEDULER (topological sort)
    - Identifies parallelizable task groups
    - Spawns Docker containers
    - Starts all ready tasks concurrently
    |
    v
PARALLEL EXECUTOR
    - Each task runs in its own container
    - Each task has its own ReAct agent loop
    - When dependencies complete -> next tasks auto-start
    - Approval gates -> pause, notify operator
    |
    v
REPORTER (SCRIBE agent)
    - Queries memory for all findings
    - Generates structured report
```

### 1.4 ReAct Agent Chain (from PentAGI performer.go)

This is the CORE loop that makes agents actually DO things:

```python
async def perform_agent_chain(agent, subtask, chain, executor, max_iterations=100):
    """Core ReAct loop. Reason -> Act -> Observe -> Repeat."""
    monitor = ExecutionMonitor(
        same_tool_limit=max_iterations // 2,
        total_limit=max_iterations,
    )

    for iteration in range(max_iterations):
        # Near limit -> invoke reflector for graceful shutdown
        if iteration >= max_iterations - 3:
            chain = await invoke_reflector(chain, "Summarize and finish.")

        # LLM decides what tool to call
        response = await llm.call_with_tools(chain, executor.get_tools(), agent.model)
        await update_token_usage(agent, response.usage)

        # No tool calls -> reflector intervention
        if not response.tool_calls:
            chain = await invoke_reflector(chain, "No action taken. Decide next step or finish.")
            continue

        for tool_call in response.tool_calls:
            # EXECUTION MONITOR: detect loops
            intervention = monitor.check(tool_call.name)
            if intervention == "adviser":
                advice = await invoke_adviser(chain, tool_call)
                chain.append(advice)
                continue
            elif intervention == "abort":
                return "failed"

            # SAFETY: scope check before environment tools
            if tool_call.name in ("terminal", "browser", "file"):
                check = await safety.validate(tool_call, agent.mission.scope, agent.mission.autonomy_level)
                if not check.allowed:
                    if check.needs_approval:
                        approved = await ask_user_barrier.ask(subtask, f"Approve: {tool_call}")
                        if not approved:
                            chain.append(tool_response(tool_call, "Operator denied."))
                            continue
                    else:
                        chain.append(tool_response(tool_call, f"Blocked: {check.reason}"))
                        continue

            # EXECUTE the tool
            result = await executor.execute(tool_call)

            # LOG to observability
            await langfuse.log_tool_call(agent, subtask, tool_call, result)
            await graphiti.store_execution(agent, tool_call, result)

            # SUMMARIZE large outputs (>16KB)
            if len(result) > 16384:
                result = await summarizer.summarize_output(result, tool_call.name)

            # BARRIER check
            if tool_call.name == "done":
                subtask.result = result
                return "done"
            elif tool_call.name == "ask":
                return "waiting"

            chain.append(tool_response(tool_call, result))

        # CHAIN summarization if too long
        if len(chain) > 50:
            chain = await summarizer.summarize_chain(chain, keep_recent=10)

    return "failed"  # max iterations
```

---

## 2. REAL AGENT DELEGATION

Agents delegate to specialists via tool calls (PentAGI pattern). When ORCHESTRATOR calls `pentester`, it spawns a sub-agent chain:

```python
# Tool registry — delegation tools
DELEGATION_TOOLS = {
    "pentester": {
        "description": "Delegate to pentester for exploitation/vuln scanning",
        "handler": lambda args: spawn_specialist("BREACH", args),
        "schema": {"task": "string", "context": "string"},
    },
    "coder": {
        "description": "Delegate to developer for code writing/fixing",
        "handler": lambda args: spawn_specialist("SAM", args),
        "schema": {"task": "string", "language": "string", "context": "string"},
    },
    "maintenance": {
        "description": "Delegate to DevOps for tool installation/env setup",
        "handler": lambda args: spawn_specialist("MAINTAINER", args),
        "schema": {"task": "string", "context": "string"},
    },
    "search": {
        "description": "Delegate to researcher for OSINT/web research",
        "handler": lambda args: spawn_specialist("SPECTER", args),
        "schema": {"query": "string", "instructions": "string"},
    },
    "memorist": {
        "description": "Delegate to archivist for past findings/knowledge",
        "handler": lambda args: spawn_specialist("SAGE", args),
        "schema": {"question": "string"},
    },
    "advice": {
        "description": "Get strategic guidance from mentor",
        "handler": lambda args: invoke_adviser_direct(args),
        "schema": {"situation": "string", "options": "string"},
    },
}

async def spawn_specialist(agent_codename: str, args: dict) -> str:
    """Create a specialist sub-agent chain with limited iterations."""
    config = AGENT_CONFIG[agent_codename]

    # Build specialist prompt
    prompt = load_prompt(agent_codename, args)

    # Run specialist ReAct loop (limited: 20 iterations)
    chain = [{"role": "system", "content": prompt}]
    chain.append({"role": "user", "content": args["task"]})

    executor = ToolExecutor(
        tools=config["tools"],
        container_id=current_task.container_id,  # shares container with parent
    )

    result = await perform_agent_chain(
        agent=specialist_agent,
        subtask=current_subtask,
        chain=chain,
        executor=executor,
        max_iterations=config.get("max_iterations", 20),
    )

    return result
```

### Agent Configuration

```python
AGENT_CONFIG = {
    "ORCHESTRATOR": {
        "model": "anthropic/claude-sonnet-4-6",
        "max_iterations": 100,
        "tools": ["pentester", "coder", "maintenance", "search", "memorist",
                  "advice", "browser", "search_in_memory", "graphiti_search",
                  "subtask_list", "subtask_patch", "done", "ask"],
        "docker_image": None,  # Runs in FastAPI
    },
    "PATHFINDER": {
        "max_iterations": 100,
        "tools": ["terminal", "file", "search_in_memory", "store_answer", "store_guide", "done"],
        "docker_image": "harbinger/pd-tools:latest",
    },
    "BREACH": {
        "max_iterations": 100,
        "tools": ["terminal", "file", "browser", "sploitus", "search_in_memory", "store_answer", "done", "ask"],
        "docker_image": "harbinger/pd-tools:latest",
    },
    "SAM": {
        "max_iterations": 100,
        "tools": ["terminal", "file", "search_code", "store_code", "done"],
        "docker_image": "harbinger/dev-tools:latest",
    },
    "SCRIBE": {
        "max_iterations": 20,
        "tools": ["search_in_memory", "search_guide", "search_answer", "graphiti_search", "report_result", "done"],
        "docker_image": "harbinger/base:latest",
    },
    "MAINTAINER": {
        "max_iterations": 100,
        "tools": ["terminal", "file", "done"],
        "docker_image": "harbinger/dev-tools:latest",
    },
    "ADVISER": {
        "max_iterations": 20,
        "tools": ["search_in_memory", "graphiti_search", "done"],
        "docker_image": None,
    },
}
```

---

## 3. PARALLEL EXECUTION ENGINE

```python
class MissionScheduler:
    """DAG-based parallel task scheduler."""

    async def execute(self, mission: Mission):
        mission.status = "running"
        tasks = await get_tasks(mission.id)
        task_map = {t.id: t for t in tasks}
        running = {}
        completed = set()
        failed = set()

        while not self.all_done(tasks, completed, failed):
            # Find tasks with all deps satisfied
            ready = [
                t for t in tasks
                if t.status == "queued"
                and all(d in completed for d in t.depends_on)
            ]

            # Approval gates
            for task in ready:
                if task.approval_required and mission.autonomy_level in ("manual", "supervised"):
                    await self.request_approval(task)
                    continue

            # Launch all ready tasks IN PARALLEL
            for task in ready:
                task.status = "running"
                container = await spawn_agent_container(mission.id, task, AGENT_CONFIG[task.agent_codename])
                task.container_id = container.id if container else None
                running[task.id] = asyncio.create_task(
                    self.execute_task_with_recovery(task, mission)
                )

            # Wait for ANY task to complete
            if running:
                done_futures, _ = await asyncio.wait(running.values(), return_when=asyncio.FIRST_COMPLETED)
                for future in done_futures:
                    tid = self.find_task_id(future, running)
                    try:
                        await future
                        completed.add(tid)
                        task_map[tid].status = "finished"
                    except Exception as e:
                        failed.add(tid)
                        task_map[tid].status = "failed"
                        await self.handle_failure(task_map[tid], e)
                    running.pop(tid, None)
            else:
                await asyncio.sleep(1)

        mission.status = "finished" if not failed else "failed"

    async def execute_task_with_recovery(self, task, mission):
        """Execute with self-healing retry."""
        for attempt in range(3):
            try:
                await execute_task(task, mission)
                return
            except ContainerFailure as e:
                if attempt < 2:
                    await self_healer.recover(task, e)
                else:
                    raise
```

### Inter-Agent Communication (ROAR Bus)

```python
class AgentBus:
    """Real-time event bus for agents in a mission."""

    def __init__(self, mission_id):
        self.mission_id = mission_id
        self.subscribers = {}
        self.event_log = []

    async def publish(self, from_agent, event_type, payload):
        event = {"from": from_agent, "type": event_type, "payload": payload, "ts": utcnow()}
        self.event_log.append(event)
        for agent, queues in self.subscribers.items():
            if agent != from_agent:
                for q in queues:
                    await q.put(event)
        await sse_broadcast(f"mission:{self.mission_id}", event)

    async def subscribe(self, agent_codename):
        q = asyncio.Queue(maxsize=100)
        self.subscribers.setdefault(agent_codename, []).append(q)
        return q
```

---

## 4. REAL TOOL EXECUTION LAYER

### 4.1 Terminal Tool (Docker exec)

```python
class TerminalTool:
    def __init__(self, container_id, docker_client):
        self.container_id = container_id
        self.docker = docker_client

    async def execute(self, args):
        command = args["command"]
        timeout = min(args.get("timeout", 60), 1200)

        exec_id = await self.docker.exec_create(self.container_id, ["sh", "-c", command], working_dir="/work")

        output = ""
        try:
            async with asyncio.timeout(timeout):
                stream = await self.docker.exec_start(exec_id, stream=True)
                async for chunk in stream:
                    output += chunk.decode()
                    await self.broadcast_output(chunk)  # SSE to dashboard
        except asyncio.TimeoutError:
            await self.docker.exec_kill(exec_id)
            output += f"\n[TIMEOUT after {timeout}s]"

        await self.log_terminal(command, output)

        if len(output) > 32768:
            output = output[:16384] + f"\n[truncated {len(output)-32768} bytes]\n" + output[-16384:]

        return output
```

### 4.2 Tool Registry

```python
TOOL_REGISTRY = {
    # Environment tools (Docker container)
    "terminal":     {"type": "environment", "desc": "Execute command in container (1200s max)"},
    "file":         {"type": "environment", "desc": "Read/write files in /work"},

    # Search tools (external APIs)
    "google":       {"type": "search", "desc": "Google Custom Search"},
    "duckduckgo":   {"type": "search", "desc": "DuckDuckGo anonymous search"},
    "tavily":       {"type": "search", "desc": "Tavily AI research"},
    "perplexity":   {"type": "search", "desc": "Perplexity full research"},
    "sploitus":     {"type": "search", "desc": "Sploitus exploit database"},
    "searxng":      {"type": "search", "desc": "Searxng meta-search"},
    "traversaal":   {"type": "search", "desc": "Traversaal web search"},

    # Browser tool
    "browser":      {"type": "search", "desc": "Headless browser via scraper"},

    # Agent delegation tools
    "pentester":    {"type": "agent", "desc": "Delegate to pentester specialist"},
    "coder":        {"type": "agent", "desc": "Delegate to developer specialist"},
    "maintenance":  {"type": "agent", "desc": "Delegate to DevOps specialist"},
    "search":       {"type": "agent", "desc": "Delegate to researcher"},
    "memorist":     {"type": "agent", "desc": "Delegate to archivist"},
    "advice":       {"type": "agent", "desc": "Get mentor guidance"},

    # Memory tools (pgvector)
    "search_in_memory":  {"type": "vector", "desc": "Semantic search in memory"},
    "search_guide":      {"type": "vector", "desc": "Search stored guides"},
    "store_guide":       {"type": "vector", "desc": "Store guide (anonymized)"},
    "search_answer":     {"type": "vector", "desc": "Search stored Q&A"},
    "store_answer":      {"type": "vector", "desc": "Store Q&A (anonymized)"},
    "search_code":       {"type": "vector", "desc": "Search stored code"},
    "store_code":        {"type": "vector", "desc": "Store code sample"},
    "graphiti_search":   {"type": "vector", "desc": "Knowledge graph temporal search"},

    # Barrier tools
    "done":         {"type": "barrier", "desc": "Finish with success/failure"},
    "ask":          {"type": "barrier", "desc": "Pause and ask operator"},

    # Subtask management
    "subtask_list":  {"type": "management", "desc": "Generate subtask list"},
    "subtask_patch": {"type": "management", "desc": "Add/remove/modify subtasks"},
    "report_result": {"type": "management", "desc": "Send report to operator"},
}
```

### 4.3 Tool API

```
POST /api/v2/tools/{name}/execute     Execute tool
GET  /api/v2/tools/{name}/stream/{id} SSE stream of output
GET  /api/v2/tools/list               All tools with schemas
POST /mcp/tools/call                  MCP tool execution
GET  /mcp/tools/list                  MCP tool discovery
```

---

## 5. SELF-HEALING SYSTEM

```python
class SelfHealingMonitor:
    async def monitor_loop(self):
        while True:
            for mission in await get_active_missions():
                for task in await get_running_tasks(mission.id):
                    # 1. Container health
                    if task.container_id:
                        health = await check_container(task.container_id)
                        if not health.healthy:
                            await self.heal_container(task, health)

                    # 2. Subtask timeout (>10min)
                    subtask = await get_current_subtask(task.id)
                    if subtask and subtask.running_for > 600:
                        await self.heal_timeout(task, subtask)

                    # 3. Agent stall (no action in 120s)
                    last = await get_last_action(task.id)
                    if last and last.age > 120:
                        await self.heal_stall(task)

            await asyncio.sleep(15)

    async def heal_container(self, task, health):
        logs = await get_container_logs(task.container_id, tail=50)
        diagnosis = await llm_diagnose(task.agent_codename, logs, health)
        await log_healing_event(task, diagnosis)

        if diagnosis.auto_fixable:
            if diagnosis.fix_type == "restart":
                await restart_container(task)
            elif diagnosis.fix_type == "oom":
                await restart_container(task, memory=4*1024*1024*1024)
            await notify(f"[SELF-HEAL] {task.agent_codename}: {diagnosis.reason}")
        else:
            task.status = "waiting"
            await notify(f"[NEEDS-HELP] {task.agent_codename}: {diagnosis.reason}\nFix: {diagnosis.suggested_fix}")

    async def heal_timeout(self, task, subtask):
        await docker_exec(task.container_id, "kill -TERM -1")
        await asyncio.sleep(5)
        subtask.status = "failed"
        subtask.result = f"Timeout after {subtask.running_for}s"
        await notify(f"[TIMEOUT] {task.agent_codename}: {subtask.title}")

    async def heal_stall(self, task):
        await inject_system_message(task,
            "You appear stalled. Summarize progress and decide: continue, ask for help, or finish.")
```

---

## 6. MEMORY + KNOWLEDGE GRAPH

### 6.1 Layered Memory

```
Layer 1: Working (Redis)        — current mission context, expires
Layer 2: Mission (PG+pgvector)  — findings THIS mission, shared across agents
Layer 3: Knowledge (pgvector)   — guides, answers, code — persists across missions
Layer 4: Graph (Neo4j+Graphiti) — entities, relationships, temporal — permanent
Layer 5: Identity (SOUL.md+PG)  — agent learned patterns — permanent
```

### 6.2 Neo4j Schema

```cypher
(:Host {ip, hostname})-[:HAS_SERVICE]->(:Service {port, protocol, product})
(:Service)-[:HAS_VULN]->(:Vulnerability {id, severity, title, evidence})
(:Vulnerability)-[:FOUND_BY]->(:Technique {tool, args, success})
(:Mission)-[:TARGETED]->(:Host)
(:Agent {codename})-[:PERFORMED {at, duration}]->(:Technique)
(:Host)-[:HAS_CREDENTIAL]->(:Credential {username, hash, valid})
```

---

## 7. OBSERVABILITY (Langfuse)

Every mission creates a trace. Every tool call is logged.

```
Trace: "Mission 123: pentest example.com"
  Span: "Task 1: Recon (PATHFINDER)"
    Span: "SubTask 1.1: subfinder"
      Tool: terminal {command, result, duration}
      Tool: store_answer {content}
    Span: "SubTask 1.2: httpx"
      Tool: terminal {command, result, duration}
    Event: "ADVISER intervention (loop detected)"
  Span: "Task 2: Scan (BREACH)"
    ...
```

**Tracked:** every action, tool call, duration, failure, decision, token usage, cost.

---

## 8. CONTINUOUS MISSION MODE

```python
class ContinuousMission:
    async def run(self):
        while self.mission.status == "running":
            recon = await self.create_task("Periodic Recon", "PATHFINDER")
            await execute_task(recon, self.mission)
            new = await self.diff_findings(recon)
            if new:
                scan = await self.create_task(f"Scan {len(new)} new targets", "BREACH")
                await execute_task(scan, self.mission)
                await notify(f"[CONTINUOUS] {len(new)} new targets found and scanned")
            await asyncio.sleep(self.scan_interval)
```

---

## 9. ASK-USER BARRIER

```python
class AskUserBarrier:
    pending = {}  # subtask_id -> {event, response}

    async def ask(self, subtask, question, options=None):
        event = asyncio.Event()
        self.pending[subtask.id] = {"event": event, "response": None}
        subtask.status = "waiting"
        await notify_all_channels(subtask, question, options)
        try:
            await asyncio.wait_for(event.wait(), timeout=3600)
            return self.pending[subtask.id]["response"]
        except asyncio.TimeoutError:
            return "No response. Proceeding with best judgment."
        finally:
            del self.pending[subtask.id]

    async def respond(self, subtask_id, response):
        if subtask_id in self.pending:
            self.pending[subtask_id]["response"] = response
            self.pending[subtask_id]["event"].set()
```

---

## 10. SUMMARIZATION ENGINE

```python
class SummarizationEngine:
    RESULT_LIMIT = 16384   # 16KB
    CHAIN_LIMIT = 50       # messages

    async def summarize_output(self, output, tool_name):
        if len(output) <= self.RESULT_LIMIT:
            return output
        return await llm.generate(f"Summarize this {tool_name} output preserving all findings:\n{output[:32768]}")

    async def summarize_chain(self, chain, keep_recent=10):
        if len(chain) <= self.CHAIN_LIMIT:
            return chain
        old = chain[:-keep_recent]
        recent = chain[-keep_recent:]
        summary = await llm.generate(f"Summarize conversation preserving findings:\n{format_chain(old)}")
        return [{"role": "system", "content": f"[Previous context]\n{summary}"}] + recent
```

---

## 11. STRANGLER FIG (AUTOMATED)

```python
ROUTE_MAP = {
    "/api/v2/missions":   {"backend": "fastapi"},
    "/api/v2/tasks":      {"backend": "fastapi"},
    "/api/v2/tools":      {"backend": "fastapi"},
    "/api/v2/warroom":    {"backend": "fastapi"},
    "/api/v2/agents/run": {"backend": "fastapi"},
    "/api/channels":      {"backend": "go"},       # Phase 2
    "/api/agents":        {"backend": "go"},       # Phase 4
    "/api/c2":            {"backend": "go"},       # Phase 5
}

def generate_nginx_config():
    """Auto-generate nginx routes from map. No manual editing."""
    # FastAPI routes
    # SSE routes (proxy_buffering off)
    # WebSocket routes
    # Default: Go backend
```

CLI: `harbinger migrate status | route | rollback | verify`

---

## 12. DOCKER AGENT IMAGES

```
harbinger/pd-tools     PATHFINDER, BREACH (recon/scan)
  nuclei, subfinder, httpx, katana, naabu, interactsh, cvemap, uncover

harbinger/kali-tools    BREACH (exploit)
  sqlmap, dalfox, ffuf, gobuster, nmap, masscan, nikto

harbinger/dev-tools     SAM, MAINTAINER
  mockhunter, semgrep, eslint, python3, node, go

harbinger/osint-tools   SPECTER
  theHarvester, Sherlock, SpiderFoot, recon-ng

harbinger/base          SCRIBE, SAGE, BRIEF
  curl, jq, git, python3
```

---

## 13. MISSION TYPES

- **full_pentest**: recon -> scan -> exploit -> post-exploit -> report
- **bug_bounty**: scope -> recon -> discover -> test -> report
- **red_team**: OSINT -> access -> C2 -> lateral -> exfil -> cleanup
- **code_audit**: static analysis -> deps -> fix -> verify -> report
- **continuous_monitor**: recon -> diff -> scan new -> alert -> repeat
- **custom**: user-defined DAG via War Room UI

---

## 14. IMPLEMENTATION ORDER

Phase 0: FastAPI sidecar + auth bridge + nginx (3 days)
Phase 1: Execution engine + ReAct loop + terminal tool (1 week)
Phase 2: Agent delegation + specialist prompts + execution monitor (1 week)
Phase 3: Docker agent images + container spawning (3 days)
Phase 4: Tool layer (search engines, browser, memory, graph) (1 week)
Phase 5: Self-healing monitor + LLM diagnosis (3 days)
Phase 6: Observability (Langfuse + metrics + SSE) (3 days)
Phase 7: Frontend wiring (task graph, dashboard, terminal) (1 week)
Phase 8: Continuous mode + CLI + channels + ROAR (1 week)
Phase 9: Go sunset + final migration (1 week)

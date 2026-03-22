# Harbinger v2.0 Phase 2: Agent System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the execution engine to real LLM calls, agent prompts, delegation tools, and a parallel DAG scheduler so missions actually execute end-to-end.

**Architecture:** LLM adapter (litellm) → agent prompts per role → delegation tools spawn sub-agents → DAG scheduler runs tasks in parallel → War Room SSE streams events to dashboard.

**Tech Stack:** litellm (multi-provider LLM), Jinja2 (prompt templates), asyncio (parallel scheduling)

**Depends on:** Phase 0+1 complete (FastAPI sidecar, ReAct performer, tool registry, Docker client)

**Already built by other terminals:**
- `src/agents/llm.py` (148 lines) — LLMAdapter with litellm, call_with_tools interface
- `src/agents/prompts/` — directory exists, needs prompt files
- `src/engine/tools/delegation.py` (273 lines) — delegation schemas + handlers
- `src/warroom/bus.py` + `src/warroom/stream.py` — EventBus + SSE streaming
- `src/routers/warroom.py` (227 lines) — War Room API endpoints

---

## File Structure

### Files to Create

```
prowlrbot-engine/src/
├── agents/
│   ├── config.py                       # Agent configuration (tools, images, iterations)
│   ├── factory.py                      # Create agent instances with prompts + tools
│   └── prompts/
│       ├── orchestrator.txt            # ORCHESTRATOR system prompt
│       ├── pathfinder.txt              # PATHFINDER (recon) prompt
│       ├── breach.txt                  # BREACH (exploit) prompt
│       ├── sam.txt                     # SAM (coder) prompt
│       ├── scribe.txt                  # SCRIBE (reporter) prompt
│       ├── maintainer.txt              # MAINTAINER (devops) prompt
│       ├── adviser.txt                 # ADVISER (mentor) prompt
│       └── specialist_base.txt         # Shared specialist preamble
│
├── engine/
│   └── scheduler.py                    # DAG scheduler (parallel task execution)
│
├── routers/
│   └── tasks.py                        # Task CRUD + status endpoints
│
└── tests/
    ├── test_llm_adapter.py
    ├── test_delegation.py
    ├── test_scheduler.py
    └── test_agent_factory.py
```

### Files to Modify

```
prowlrbot-engine/src/engine/executor.py    # Wire LLMAdapter + delegation into task execution
prowlrbot-engine/src/routers/missions.py   # Replace placeholder with real scheduler
prowlrbot-engine/src/engine/tools/registry.py  # Register delegation tools
prowlrbot-engine/src/main.py               # Register new routers
prowlrbot-engine/pyproject.toml            # Add litellm, jinja2 deps
```

---

## Tasks

### Task 1: Add Dependencies (litellm, jinja2)

**Files:**
- Modify: `prowlrbot-engine/pyproject.toml`

- [ ] **Step 1: Add litellm and jinja2 to dependencies**

Add to the `dependencies` list in pyproject.toml:
```toml
    "litellm>=1.55.0",
    "jinja2>=3.1.0",
```

- [ ] **Step 2: Install and verify**

```bash
cd prowlrbot-engine && pip install -e ".[dev]" && python -c "import litellm; print('litellm OK')"
```

- [ ] **Step 3: Commit**

```bash
git add prowlrbot-engine/pyproject.toml
git commit -m "feat(engine): add litellm + jinja2 dependencies for agent system"
```

---

### Task 2: Agent Configuration

**Files:**
- Create: `prowlrbot-engine/src/agents/config.py`

- [ ] **Step 1: Write agent config**

```python
"""Agent configuration — tools, Docker images, iteration limits per role."""

AGENT_CONFIG: dict[str, dict] = {
    "ORCHESTRATOR": {
        "tools": [
            "pentester", "coder", "maintenance", "search", "memorist", "advice",
            "browser", "search_in_memory", "graphiti_search",
            "subtask_list", "subtask_patch", "done", "ask",
        ],
        "docker_image": None,  # Runs in FastAPI process
        "max_iterations": 100,
        "model": None,  # Uses default
    },
    "PATHFINDER": {
        "tools": ["terminal", "file", "search_in_memory", "store_answer", "store_guide", "done"],
        "docker_image": "harbinger/pd-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "BREACH": {
        "tools": ["terminal", "file", "browser", "sploitus", "search_in_memory", "store_answer", "done", "ask"],
        "docker_image": "harbinger/pd-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "PHANTOM": {
        "tools": ["terminal", "file", "search_in_memory", "done", "ask"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
        "model": None,
    },
    "SPECTER": {
        "tools": ["terminal", "file", "search_in_memory", "store_answer", "done"],
        "docker_image": "harbinger/osint-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "CIPHER": {
        "tools": ["terminal", "file", "search_in_memory", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 100,
        "model": None,
    },
    "SAM": {
        "tools": ["terminal", "file", "search_code", "store_code", "done"],
        "docker_image": "harbinger/dev-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "SCRIBE": {
        "tools": ["search_in_memory", "search_guide", "search_answer", "graphiti_search", "report_result", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 20,
        "model": None,
    },
    "SAGE": {
        "tools": ["search_in_memory", "search_guide", "graphiti_search", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 20,
        "model": None,
    },
    "MAINTAINER": {
        "tools": ["terminal", "file", "done"],
        "docker_image": "harbinger/dev-tools:latest",
        "max_iterations": 100,
        "model": None,
    },
    "LENS": {
        "tools": ["terminal", "browser", "file", "done"],
        "docker_image": "harbinger/base:latest",
        "max_iterations": 50,
        "model": None,
    },
    "ADVISER": {
        "tools": ["search_in_memory", "graphiti_search", "done"],
        "docker_image": None,  # Runs in FastAPI process
        "max_iterations": 20,
        "model": None,
    },
}

DEFAULT_CONFIG = {
    "tools": ["terminal", "file", "done"],
    "docker_image": "harbinger/base:latest",
    "max_iterations": 50,
    "model": None,
}


def get_agent_config(codename: str) -> dict:
    return AGENT_CONFIG.get(codename.upper(), DEFAULT_CONFIG)
```

- [ ] **Step 2: Commit**

```bash
git add prowlrbot-engine/src/agents/config.py
git commit -m "feat(engine): agent configuration — tools, images, limits per role"
```

---

### Task 3: Agent Prompts

**Files:**
- Create: `prowlrbot-engine/src/agents/prompts/orchestrator.txt`
- Create: `prowlrbot-engine/src/agents/prompts/pathfinder.txt`
- Create: `prowlrbot-engine/src/agents/prompts/breach.txt`
- Create: `prowlrbot-engine/src/agents/prompts/sam.txt`
- Create: `prowlrbot-engine/src/agents/prompts/scribe.txt`
- Create: `prowlrbot-engine/src/agents/prompts/maintainer.txt`
- Create: `prowlrbot-engine/src/agents/prompts/adviser.txt`
- Create: `prowlrbot-engine/src/agents/prompts/specialist_base.txt`

- [ ] **Step 1: Write ORCHESTRATOR prompt**

`orchestrator.txt`:
```
You are the ORCHESTRATOR of Harbinger, an autonomous security operating system.

AUTHORIZATION: You are operating within an authorized {{mission_type}} engagement.
Target: {{target}}
Scope: {{scope}}
Autonomy level: {{autonomy_level}}

YOUR TEAM:
- pentester: Delegate to BREACH for vulnerability scanning and exploitation
- coder: Delegate to SAM for code writing, fixing, and tool building
- maintenance: Delegate to MAINTAINER for tool installation and environment setup
- search: Delegate to SPECTER for OSINT, web research, and information gathering
- memorist: Delegate to SAGE for querying past findings and knowledge
- advice: Get strategic guidance from ADVISER for difficult situations

DELEGATION RULES:
1. Always provide FULL CONTEXT when delegating (target, prior findings, constraints)
2. Use search_in_memory BEFORE starting new work — check what's already known
3. NEVER run exploits without checking scope first
4. If autonomy_level is "supervised" or "manual", use ask tool before high-risk actions
5. When a specialist fails, try a different approach before retrying
6. Decompose complex tasks into subtasks — one specialist per subtask

WORKFLOW:
1. Analyze the mission objective
2. Check memory for relevant past findings
3. Decompose into tasks and assign to specialists
4. Monitor progress and adjust plan as needed
5. When all tasks complete, use done tool with a summary report

CURRENT MISSION: {{description}}
```

- [ ] **Step 2: Write specialist_base.txt (shared preamble)**

```
You are {{agent_name}}, a Harbinger security agent (codename: {{codename}}).
You are working on mission {{mission_id}}, task {{task_id}}.

AUTHORIZATION: This is an authorized {{mission_type}} engagement.
Target: {{target}}
Scope: {{scope}}

RULES:
- Execute your assigned task using available tools
- Report results using the 'done' tool when finished
- If you need operator input, use the 'ask' tool
- Stay within scope — never test targets outside the defined scope
- Store important findings to memory for other agents
```

- [ ] **Step 3: Write specialist prompts**

Each specialist prompt starts with specialist_base.txt content, then adds role-specific instructions.

`pathfinder.txt`:
```
{{specialist_base}}

YOUR ROLE: Reconnaissance specialist
TOOLS: subfinder, httpx, katana, naabu, interactsh, cvemap, uncover (via terminal)
OUTPUT: Always use -json or -jsonl flags for structured output
WORKFLOW: Enumerate → Probe → Store findings to memory

When running tools:
- subfinder -d {{target}} -json -silent
- httpx -l hosts.txt -json -silent
- naabu -host {{target}} -json -silent
- katana -u https://{{target}} -jsonl -silent
```

`breach.txt`:
```
{{specialist_base}}

YOUR ROLE: Exploitation specialist
TOOLS: nuclei, sqlmap, dalfox, ffuf (via terminal), sploitus (search)
CRITICAL: Always use ask tool before running active exploits
WORKFLOW: Scan → Verify → Exploit (with approval) → Document

When running tools:
- nuclei -l targets.txt -severity critical,high -jsonl
- Check sploitus for known exploits before manual testing
- Document every finding with: severity, evidence, reproduction steps
```

`sam.txt`:
```
{{specialist_base}}

YOUR ROLE: Development specialist
TOOLS: mockhunter, semgrep, python3, node, go, git (via terminal)
WORKFLOW: Analyze → Fix → Test → Verify

When fixing code:
- Run mockhunter scan first to identify issues
- Fix one issue at a time
- Run tests after each fix
- Never ship broken code
```

`scribe.txt`:
```
{{specialist_base}}

YOUR ROLE: Report writer
TOOLS: search_in_memory, search_guide, graphiti_search, report_result
WORKFLOW: Query memory → Organize findings → Generate report

Report structure:
1. Executive Summary
2. Scope and Methodology
3. Findings (by severity: Critical → High → Medium → Low → Info)
4. Recommendations
5. Technical Details (reproduction steps, evidence)
```

`maintainer.txt`:
```
{{specialist_base}}

YOUR ROLE: DevOps and environment specialist
TOOLS: terminal (apt-get, pip, go install, etc.), file
WORKFLOW: Diagnose → Install/Configure → Verify

Install tools as needed. Verify they work before reporting success.
```

`adviser.txt`:
```
You are the ADVISER, a strategic mentor for Harbinger security agents.

When consulted:
1. Analyze the situation described
2. Consider multiple approaches
3. Recommend the most effective path forward
4. Flag any risks or concerns

You do NOT execute tools. You provide guidance only.
Previous context: {{context}}
```

- [ ] **Step 4: Commit**

```bash
git add prowlrbot-engine/src/agents/prompts/
git commit -m "feat(engine): agent system prompts — ORCHESTRATOR + 7 specialists"
```

---

### Task 4: Agent Factory

**Files:**
- Create: `prowlrbot-engine/src/agents/factory.py`
- Create: `prowlrbot-engine/tests/test_agent_factory.py`

- [ ] **Step 1: Write the failing test**

```python
import pytest
from src.agents.factory import build_agent_chain, load_prompt


def test_load_orchestrator_prompt():
    prompt = load_prompt("orchestrator", {
        "mission_type": "full_pentest",
        "target": "example.com",
        "scope": "*.example.com",
        "autonomy_level": "supervised",
        "description": "Pentest example.com",
    })
    assert "ORCHESTRATOR" in prompt
    assert "example.com" in prompt
    assert "supervised" in prompt


def test_load_specialist_prompt():
    prompt = load_prompt("pathfinder", {
        "agent_name": "PATHFINDER",
        "codename": "PATHFINDER",
        "mission_id": 1,
        "task_id": 1,
        "mission_type": "full_pentest",
        "target": "example.com",
        "scope": "*.example.com",
    })
    assert "PATHFINDER" in prompt
    assert "subfinder" in prompt


def test_build_agent_chain():
    chain = build_agent_chain(
        codename="PATHFINDER",
        mission_id=1,
        task_id=1,
        task_input="Enumerate subdomains of example.com",
        context={"target": "example.com", "mission_type": "full_pentest", "scope": "*"},
    )
    assert chain[0]["role"] == "system"
    assert "PATHFINDER" in chain[0]["content"]
    assert chain[1]["role"] == "user"
    assert "subdomains" in chain[1]["content"]
```

- [ ] **Step 2: Implement factory.py**

```python
"""Agent factory — build agent chains with role-specific prompts."""

import os
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(agent_type: str, context: dict) -> str:
    """Load and render an agent prompt template."""
    prompt_file = PROMPTS_DIR / f"{agent_type.lower()}.txt"
    if not prompt_file.exists():
        prompt_file = PROMPTS_DIR / "specialist_base.txt"

    template = prompt_file.read_text()

    # Load specialist_base if referenced
    if "{{specialist_base}}" in template:
        base = (PROMPTS_DIR / "specialist_base.txt").read_text()
        # Render base first
        for key, value in context.items():
            base = base.replace("{{" + key + "}}", str(value))
        template = template.replace("{{specialist_base}}", base)

    # Render remaining variables
    for key, value in context.items():
        template = template.replace("{{" + key + "}}", str(value))

    return template


def build_agent_chain(
    codename: str,
    mission_id: int,
    task_id: int,
    task_input: str,
    context: dict,
) -> list[dict]:
    """Build an initial message chain for an agent."""
    prompt_context = {
        "agent_name": codename,
        "codename": codename,
        "mission_id": str(mission_id),
        "task_id": str(task_id),
        **context,
    }

    system_prompt = load_prompt(codename, prompt_context)

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": task_input},
    ]
```

- [ ] **Step 3: Run tests**

```bash
cd prowlrbot-engine && python -m pytest tests/test_agent_factory.py -v
```

- [ ] **Step 4: Commit**

```bash
git add prowlrbot-engine/src/agents/factory.py prowlrbot-engine/tests/test_agent_factory.py
git commit -m "feat(engine): agent factory — build chains with role-specific prompts"
```

---

### Task 5: Wire Delegation Tools into Registry

**Files:**
- Modify: `prowlrbot-engine/src/engine/tools/registry.py`

- [ ] **Step 1: Read existing registry.py and delegation.py**

Check what's already there. The registry needs to accept delegation tools alongside container tools.

- [ ] **Step 2: Update ToolExecutor to support delegation tools**

Add a `delegation_handler` parameter to ToolExecutor.__init__. When a delegation tool (pentester, coder, etc.) is called, it invokes the handler instead of Docker exec.

```python
# In ToolExecutor.__init__, add:
if delegation_handler:
    for tool_name, schema in DELEGATION_SCHEMAS.items():
        if tool_name in allowed_tools:
            self._schemas[tool_name] = schema
            self._tools[tool_name] = DelegationToolWrapper(tool_name, delegation_handler)
```

- [ ] **Step 3: Commit**

```bash
git add prowlrbot-engine/src/engine/tools/registry.py
git commit -m "feat(engine): wire delegation tools into tool registry"
```

---

### Task 6: DAG Scheduler

**Files:**
- Create: `prowlrbot-engine/src/engine/scheduler.py`
- Create: `prowlrbot-engine/tests/test_scheduler.py`

- [ ] **Step 1: Write the failing test**

```python
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from src.engine.scheduler import MissionScheduler


@pytest.mark.asyncio
async def test_scheduler_runs_independent_tasks_in_parallel():
    """Tasks with no dependencies should run concurrently."""
    execution_order = []

    async def mock_execute(task, mission, llm):
        execution_order.append(f"start:{task.id}")
        await asyncio.sleep(0.05)
        execution_order.append(f"end:{task.id}")
        task.status = "finished"

    scheduler = MissionScheduler(execute_fn=mock_execute)
    # Two tasks with no deps
    tasks = [
        MockTask(id=1, depends_on=[], status="queued"),
        MockTask(id=2, depends_on=[], status="queued"),
    ]
    await scheduler.execute(tasks, mission=MockMission(), llm=None)

    # Both should start before either finishes (parallel)
    assert execution_order[0] == "start:1" or execution_order[0] == "start:2"
    assert execution_order[1].startswith("start:")  # Second starts before first ends


@pytest.mark.asyncio
async def test_scheduler_respects_dependencies():
    """Task 2 depends on Task 1 — must run sequentially."""
    execution_order = []

    async def mock_execute(task, mission, llm):
        execution_order.append(f"start:{task.id}")
        await asyncio.sleep(0.01)
        execution_order.append(f"end:{task.id}")
        task.status = "finished"

    scheduler = MissionScheduler(execute_fn=mock_execute)
    tasks = [
        MockTask(id=1, depends_on=[], status="queued"),
        MockTask(id=2, depends_on=[1], status="queued"),
    ]
    await scheduler.execute(tasks, mission=MockMission(), llm=None)

    # Task 1 must finish before Task 2 starts
    assert execution_order.index("end:1") < execution_order.index("start:2")


class MockTask:
    def __init__(self, id, depends_on, status="queued", approval_required=False, agent_codename="TEST"):
        self.id = id
        self.depends_on = depends_on
        self.status = status
        self.approval_required = approval_required
        self.agent_codename = agent_codename
        self.result = None

class MockMission:
    def __init__(self):
        self.id = 1
        self.autonomy_level = "autonomous"
        self.status = "running"
```

- [ ] **Step 2: Implement scheduler**

```python
"""DAG scheduler — execute mission tasks respecting dependencies, parallelizing where possible."""

import asyncio
import logging
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


class MissionScheduler:
    def __init__(self, execute_fn: Callable[..., Coroutine]):
        self.execute_fn = execute_fn

    async def execute(self, tasks: list, mission: Any, llm: Any):
        """Execute task DAG with parallel scheduling."""
        task_map = {t.id: t for t in tasks}
        running: dict[int, asyncio.Task] = {}
        completed: set[int] = set()
        failed: set[int] = set()

        while True:
            # Check if all done
            all_ids = {t.id for t in tasks}
            if completed | failed >= all_ids:
                break

            # Find ready tasks (deps satisfied, not running, not done)
            ready = [
                t for t in tasks
                if t.status == "queued"
                and t.id not in running
                and t.id not in completed
                and t.id not in failed
                and all(d in completed for d in (t.depends_on or []))
            ]

            # Launch ready tasks
            for task in ready:
                task.status = "running"
                running[task.id] = asyncio.create_task(
                    self._run_with_recovery(task, mission, llm)
                )

            if not running:
                # No tasks running and none ready — deadlock or all done
                break

            # Wait for any task to complete
            done_futures, _ = await asyncio.wait(
                running.values(), return_when=asyncio.FIRST_COMPLETED
            )

            for future in done_futures:
                tid = self._find_task_id(future, running)
                if tid is None:
                    continue
                try:
                    await future
                    completed.add(tid)
                    logger.info("Task %d completed", tid)
                except Exception as e:
                    failed.add(tid)
                    task_map[tid].status = "failed"
                    task_map[tid].result = str(e)
                    logger.error("Task %d failed: %s", tid, e)
                running.pop(tid, None)

        mission.status = "finished" if not failed else "failed"

    async def _run_with_recovery(self, task, mission, llm):
        """Execute task with one retry on failure."""
        try:
            await self.execute_fn(task, mission, llm)
        except Exception:
            logger.warning("Task %d failed, retrying once", task.id)
            await self.execute_fn(task, mission, llm)

    @staticmethod
    def _find_task_id(future, running):
        for tid, task in running.items():
            if task is future:
                return tid
        return None
```

- [ ] **Step 3: Run tests**

```bash
cd prowlrbot-engine && python -m pytest tests/test_scheduler.py -v
```

- [ ] **Step 4: Commit**

```bash
git add prowlrbot-engine/src/engine/scheduler.py prowlrbot-engine/tests/test_scheduler.py
git commit -m "feat(engine): DAG scheduler — parallel task execution with dependency ordering"
```

---

### Task 7: Wire Everything into Mission Execution

**Files:**
- Modify: `prowlrbot-engine/src/engine/executor.py`
- Modify: `prowlrbot-engine/src/routers/missions.py`

- [ ] **Step 1: Update executor to use LLMAdapter + agent factory**

Replace the stub executor with real execution:

```python
# In executor.py, update execute_task to:
# 1. Create LLMAdapter instance
# 2. Use build_agent_chain() for prompts
# 3. Use get_agent_config() for tools/image
# 4. Wire delegation_handler for ORCHESTRATOR
```

- [ ] **Step 2: Update missions router to use DAG scheduler**

Replace `run_mission_background` with:
```python
async def run_mission_background(mission_id: int):
    from src.agents.llm import LLMAdapter
    from src.engine.scheduler import MissionScheduler

    llm = LLMAdapter()
    scheduler = MissionScheduler(execute_fn=execute_single_task)

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        tasks = await get_mission_tasks(session, mission_id)
        await scheduler.execute(tasks, mission, llm)
        await session.commit()
```

- [ ] **Step 3: Test end-to-end (manual)**

```bash
# Create a mission
curl -X POST http://localhost:8980/api/v2/missions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test E2E","target":"example.com","mission_type":"full_pentest"}'

# Execute it
curl -X POST http://localhost:8980/api/v2/missions/1/execute
```

- [ ] **Step 4: Commit**

```bash
git add prowlrbot-engine/src/engine/executor.py prowlrbot-engine/src/routers/missions.py
git commit -m "feat(engine): wire LLM adapter + scheduler into mission execution"
```

---

### Task 8: Tasks Router (CRUD + status)

**Files:**
- Create: `prowlrbot-engine/src/routers/tasks.py`
- Modify: `prowlrbot-engine/src/main.py` — register router

- [ ] **Step 1: Write tasks router**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from src.db import async_session, db_available
from src.models.task import Task
from src.models.subtask import SubTask

router = APIRouter(prefix="/api/v2/tasks", tags=["tasks"])

class TaskResponse(BaseModel):
    id: int
    mission_id: int
    title: str
    status: str
    agent_codename: str
    position: int
    class Config:
        from_attributes = True

@router.get("/mission/{mission_id}", response_model=list[TaskResponse])
async def list_mission_tasks(mission_id: int):
    if not db_available():
        return []
    async with async_session() as session:
        result = await session.execute(
            select(Task).where(Task.mission_id == mission_id).order_by(Task.position)
        )
        return result.scalars().all()

@router.get("/{task_id}")
async def get_task(task_id: int):
    if not db_available():
        raise HTTPException(503, "Database not available")
    async with async_session() as session:
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        # Include subtasks
        subtasks = await session.execute(
            select(SubTask).where(SubTask.task_id == task_id).order_by(SubTask.position)
        )
        return {
            "task": TaskResponse.model_validate(task),
            "subtasks": [{"id": s.id, "title": s.title, "status": s.status, "result": s.result} for s in subtasks.scalars()],
        }
```

- [ ] **Step 2: Register in main.py**

- [ ] **Step 3: Commit**

```bash
git add prowlrbot-engine/src/routers/tasks.py prowlrbot-engine/src/main.py
git commit -m "feat(engine): tasks router — CRUD + subtask listing per task"
```

---

## Verification Checklist

After all 8 tasks:

- [ ] `cd prowlrbot-engine && python -m pytest tests/ -v` — all tests pass
- [ ] `POST /api/v2/missions` — creates mission
- [ ] `POST /api/v2/missions/{id}/execute` — starts real execution with LLM
- [ ] `GET /api/v2/tasks/mission/{id}` — lists tasks with statuses
- [ ] Agent prompts render correctly with context variables
- [ ] DAG scheduler runs independent tasks in parallel
- [ ] Delegation tools spawn sub-agent chains

---

## What Phase 3 Builds On This

Phase 3 (Docker Agent Images) adds:
- `harbinger/pd-tools` image with ProjectDiscovery suite
- `harbinger/kali-tools` image with exploitation tools
- `harbinger/dev-tools` image with MockHunter, semgrep
- `harbinger/osint-tools` image with OSINT tools
- Real tool execution in purpose-built containers

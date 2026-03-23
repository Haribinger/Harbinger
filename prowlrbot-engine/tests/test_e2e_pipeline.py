"""
End-to-end pipeline test — validates the full mission lifecycle:

  scheduler → executor → performer → tools → done

Uses:
  - Injectable scheduler mode (no DB dependency)
  - Mock LLM (returns tool calls deterministically)
  - In-process execution (no Docker containers)

This test proves the plumbing works end-to-end without external dependencies.
For full-stack tests with DB and Docker, use docker compose + test_integration_mission.py.
"""

import json
import logging

import pytest
from unittest.mock import MagicMock

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Mock LLM — returns 'done' tool call immediately
# ---------------------------------------------------------------------------


class MockLLM:
    """Mock LLM that returns 'done' tool call on first invocation."""

    def __init__(self):
        self.call_count = 0

    async def call_with_tools(self, chain, tools=None, model=None):
        self.call_count += 1
        tc = {
            "id": f"call_{self.call_count}",
            "name": "done",
            "args": {"result": f"Task completed (call {self.call_count})", "success": True},
        }
        chain.append({
            "role": "assistant",
            "content": "",
            "tool_calls": [{"id": tc["id"], "type": "function", "function": {"name": "done", "arguments": json.dumps(tc["args"])}}],
        })
        return {
            "tool_calls": [tc],
            "content": None,
            "usage": {"input": 100, "output": 50},
        }


class FailingLLM:
    """Mock LLM that always fails."""

    async def call_with_tools(self, chain, tools=None, model=None):
        return {
            "tool_calls": [],
            "content": None,
            "usage": {"input": 0, "output": 0},
            "error": "LLM provider unavailable",
        }


# ---------------------------------------------------------------------------
# Helper: create mock task objects for injectable scheduler
# ---------------------------------------------------------------------------


class MockTask:
    def __init__(self, id, depends_on=None, agent="ADVISER", priority=0):
        self.id = id
        self.depends_on = depends_on or []
        self.status = "queued"
        self.result = None
        self.agent_codename = agent
        self.docker_image = None  # In-process, no container
        self.description = f"Test task {id}"
        self.input = None
        self.priority = priority
        self.approval_required = False
        self.position = id


class MockMission:
    def __init__(self, id=1):
        self.id = id
        self.status = "running"


# ---------------------------------------------------------------------------
# Tests: Performer E2E
# ---------------------------------------------------------------------------


class TestPerformerE2E:
    """Test the ReAct performer directly with mock LLM."""

    async def test_performer_completes_with_done_tool(self):
        """Performer should return done when LLM calls the done tool."""
        from src.engine.performer import perform_agent_chain
        from src.engine.tools.registry import ToolExecutor

        llm = MockLLM()
        executor = ToolExecutor(
            allowed_tools=["done"],
            container_id=None,
            docker_client=None,
        )

        chain = [
            {"role": "system", "content": "You are a test agent."},
            {"role": "user", "content": "Complete the test."},
        ]

        result = await perform_agent_chain(
            chain=chain,
            executor=executor,
            llm=llm,
            max_iterations=10,
        )

        assert result["status"] == "done"
        assert "completed" in result["result"].lower()
        assert result["tokens"]["input"] == 100
        assert result["tokens"]["output"] == 50

    async def test_executor_in_process_mode(self):
        """execute_task should work without Docker when image is None."""
        from src.engine.executor import execute_task

        llm = MockLLM()
        result = await execute_task(
            task_id=999,
            agent_codename="ADVISER",
            docker_image=None,
            mission_id=1,
            task_input="Provide analysis of the target",
            llm=llm,
        )

        assert result["status"] == "done"
        assert result["tokens"]["input"] > 0

    async def test_executor_uses_agent_prompt(self):
        """execute_task should load the agent's prompt from markdown files."""
        from src.engine.executor import execute_task

        llm = MockLLM()
        # Use ADVISER — no docker_image in config, runs in-process
        result = await execute_task(
            task_id=1,
            agent_codename="ADVISER",
            docker_image=None,
            mission_id=42,
            task_input="Provide strategic guidance",
            llm=llm,
        )

        assert result["status"] == "done"
        # Verify the system prompt was built (chain[0] should contain agent name)
        chain = result.get("chain", [])
        if chain:
            system_msg = chain[0].get("content", "")
            assert "ADVISER" in system_msg or len(system_msg) > 50


# ---------------------------------------------------------------------------
# Tests: Scheduler E2E (injectable mode — no DB)
# ---------------------------------------------------------------------------


class TestSchedulerE2E:
    """Test the DAG scheduler with injectable mode."""

    async def test_single_task_execution(self):
        """Scheduler completes a single-task mission."""
        from src.engine.scheduler import MissionScheduler

        tasks_executed = []

        async def fake_execute(task, mission, llm):
            tasks_executed.append(task.id)
            task.status = "finished"

        mission = MockMission()
        tasks = [MockTask(id=1)]
        scheduler = MissionScheduler(execute_fn=fake_execute)

        status = await scheduler.execute(tasks, mission, MockLLM())
        assert status == "finished"
        assert tasks_executed == [1]

    async def test_parallel_independent_tasks(self):
        """Two independent tasks should both complete."""
        from src.engine.scheduler import MissionScheduler

        tasks_executed = []

        async def fake_execute(task, mission, llm):
            tasks_executed.append(task.id)
            task.status = "finished"

        mission = MockMission()
        tasks = [MockTask(id=1), MockTask(id=2)]
        scheduler = MissionScheduler(execute_fn=fake_execute)

        status = await scheduler.execute(tasks, mission, MockLLM())
        assert status == "finished"
        assert set(tasks_executed) == {1, 2}

    async def test_dependency_ordering(self):
        """Task B depends on Task A — A must finish before B starts."""
        from src.engine.scheduler import MissionScheduler

        execution_order = []

        async def fake_execute(task, mission, llm):
            execution_order.append(task.id)
            task.status = "finished"

        mission = MockMission()
        tasks = [
            MockTask(id=1),             # A: no deps
            MockTask(id=2, depends_on=[1]),  # B: depends on A
        ]
        scheduler = MissionScheduler(execute_fn=fake_execute)

        status = await scheduler.execute(tasks, mission, MockLLM())
        assert status == "finished"
        assert execution_order.index(1) < execution_order.index(2)

    async def test_diamond_dag(self):
        """Diamond: A -> B, A -> C, B+C -> D."""
        from src.engine.scheduler import MissionScheduler

        execution_order = []

        async def fake_execute(task, mission, llm):
            execution_order.append(task.id)
            task.status = "finished"

        mission = MockMission()
        tasks = [
            MockTask(id=1),                   # A
            MockTask(id=2, depends_on=[1]),    # B
            MockTask(id=3, depends_on=[1]),    # C
            MockTask(id=4, depends_on=[2, 3]), # D
        ]
        scheduler = MissionScheduler(execute_fn=fake_execute)

        status = await scheduler.execute(tasks, mission, MockLLM())
        assert status == "finished"
        assert len(execution_order) == 4
        # A must be before B, C; B and C must be before D
        assert execution_order.index(1) < execution_order.index(2)
        assert execution_order.index(1) < execution_order.index(3)
        assert execution_order.index(2) < execution_order.index(4)
        assert execution_order.index(3) < execution_order.index(4)

    async def test_task_failure_marks_mission_failed(self):
        """If any task fails, mission status is 'failed'."""
        from src.engine.scheduler import MissionScheduler

        async def fake_execute(task, mission, llm):
            if task.id == 2:
                raise RuntimeError("Simulated failure")
            task.status = "finished"

        mission = MockMission()
        tasks = [MockTask(id=1), MockTask(id=2)]
        scheduler = MissionScheduler(execute_fn=fake_execute)

        status = await scheduler.execute(tasks, mission, MockLLM())
        assert status == "failed"

    async def test_full_pipeline_performer_integration(self):
        """Full pipeline: scheduler → executor → performer → tools → done.

        This is the real E2E — the scheduler calls execute_task which builds
        a ToolExecutor and runs perform_agent_chain with the mock LLM.
        """
        from src.engine.executor import execute_task

        llm = MockLLM()
        execution_results = {}

        async def real_execute(task, mission, llm_arg):
            result = await execute_task(
                task_id=task.id,
                agent_codename=task.agent_codename,
                docker_image=None,  # In-process
                mission_id=mission.id,
                task_input=task.description,
                llm=llm_arg,
            )
            task.status = result["status"]
            task.result = result.get("result")
            execution_results[task.id] = result

        from src.engine.scheduler import MissionScheduler

        mission = MockMission(id=42)
        # Use agents with no docker_image so execute_task runs in-process
        tasks = [
            MockTask(id=1, agent="ADVISER"),
            MockTask(id=2, agent="ADVISER", depends_on=[1]),
        ]

        scheduler = MissionScheduler(execute_fn=real_execute)
        status = await scheduler.execute(tasks, mission, llm)

        assert status == "finished", f"Mission failed: {[t.result for t in tasks]}"
        assert len(execution_results) == 2
        assert execution_results[1]["status"] == "done"
        assert execution_results[2]["status"] == "done"
        assert llm.call_count == 2  # One LLM call per task

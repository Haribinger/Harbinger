"""Tests for the DAG-based MissionScheduler (injectable mode).

Uses plain mock objects — no database, no Docker, no AgentBus required.
Validates parallel execution, dependency ordering, and failure isolation.
"""

import asyncio

import pytest


class MockTask:
    def __init__(self, id, depends_on=None, status="queued", agent_codename="TEST"):
        self.id = id
        self.depends_on = depends_on or []
        self.status = status
        self.agent_codename = agent_codename
        self.result = None


class MockMission:
    def __init__(self):
        self.id = 1
        self.autonomy_level = "autonomous"
        self.status = "running"


@pytest.mark.asyncio
async def test_scheduler_runs_independent_tasks_in_parallel():
    order = []

    async def mock_exec(task, mission, llm):
        order.append(f"start:{task.id}")
        await asyncio.sleep(0.05)
        order.append(f"end:{task.id}")
        task.status = "finished"

    from src.engine.scheduler import MissionScheduler

    sched = MissionScheduler(execute_fn=mock_exec)
    tasks = [MockTask(id=1), MockTask(id=2)]
    await sched.execute(tasks, MockMission(), None)

    # Both tasks must start before either finishes — proves true parallelism
    starts = [e for e in order if e.startswith("start:")]
    ends = [e for e in order if e.startswith("end:")]
    assert len(starts) == 2
    assert order.index(starts[1]) < order.index(ends[0])


@pytest.mark.asyncio
async def test_scheduler_respects_dependencies():
    order = []

    async def mock_exec(task, mission, llm):
        order.append(f"start:{task.id}")
        await asyncio.sleep(0.01)
        order.append(f"end:{task.id}")
        task.status = "finished"

    from src.engine.scheduler import MissionScheduler

    sched = MissionScheduler(execute_fn=mock_exec)
    # Task 2 must not start until task 1 has finished
    tasks = [MockTask(id=1), MockTask(id=2, depends_on=[1])]
    await sched.execute(tasks, MockMission(), None)

    assert order.index("end:1") < order.index("start:2")


@pytest.mark.asyncio
async def test_scheduler_handles_task_failure():
    async def mock_exec(task, mission, llm):
        if task.id == 1:
            raise RuntimeError("boom")
        task.status = "finished"

    from src.engine.scheduler import MissionScheduler

    sched = MissionScheduler(execute_fn=mock_exec)
    tasks = [MockTask(id=1), MockTask(id=2)]
    await sched.execute(tasks, MockMission(), None)

    # Failed task is marked failed; independent task still completes
    assert tasks[0].status == "failed"
    assert tasks[1].status == "finished"

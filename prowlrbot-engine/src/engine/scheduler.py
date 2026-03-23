"""
MissionScheduler — DAG-based parallel task execution.

Reads the task dependency graph (depends_on arrays), topologically sorts them,
and runs independent task groups concurrently.  Approval gates pause tasks
until an operator responds.  Container lifecycle is managed by execute_task.

Events are published to the AgentBus so T1 (Mission Control), T2 (Agent Watch),
and T3 (Findings Feed) see updates in real-time.
"""

import asyncio
import logging
from datetime import datetime

import src.db as db
from src.engine.executor import execute_task
from src.models.mission import Mission
from src.models.task import Task
from src.warroom.bus import agent_bus, EVENT_MISSION_UPDATE, EVENT_TASK_UPDATE

logger = logging.getLogger(__name__)


class ApprovalGate:
    """Manages approval requests for tasks that need operator sign-off."""

    def __init__(self):
        self._pending: dict[int, asyncio.Event] = {}
        self._responses: dict[int, bool] = {}

    async def request_approval(self, task_id: int, timeout: float = 3600) -> bool:
        """Block until operator approves/denies or timeout expires."""
        event = asyncio.Event()
        self._pending[task_id] = event
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            return self._responses.get(task_id, False)
        except asyncio.TimeoutError:
            logger.warning("approval timeout for task %d", task_id)
            return False
        finally:
            self._pending.pop(task_id, None)
            self._responses.pop(task_id, None)

    def respond(self, task_id: int, approved: bool) -> bool:
        """Operator responds to an approval request. Returns False if no pending request."""
        if task_id not in self._pending:
            return False
        self._responses[task_id] = approved
        self._pending[task_id].set()
        return True

    @property
    def pending_tasks(self) -> list[int]:
        return list(self._pending.keys())


# Singleton — shared across the FastAPI process
approval_gate = ApprovalGate()


def topological_sort(tasks: list[Task]) -> list[list[int]]:
    """Sort tasks into execution layers using Kahn's algorithm.

    Returns a list of layers, where each layer contains task IDs that can
    run in parallel (all their dependencies are in earlier layers).

    Example:
        Tasks A(deps=[]), B(deps=[]), C(deps=[A,B]), D(deps=[C])
        Returns: [[A.id, B.id], [C.id], [D.id]]
    """
    task_map = {t.id: t for t in tasks}
    # Build adjacency: task_id -> set of task_ids that depend on it
    dependents: dict[int, set[int]] = {t.id: set() for t in tasks}
    in_degree: dict[int, int] = {t.id: 0 for t in tasks}

    for t in tasks:
        deps = t.depends_on or []
        for dep_id in deps:
            if dep_id in dependents:
                dependents[dep_id].add(t.id)
                in_degree[t.id] = in_degree.get(t.id, 0) + 1

    layers: list[list[int]] = []
    ready = [tid for tid, deg in in_degree.items() if deg == 0]

    while ready:
        # Sort by priority (descending) for deterministic ordering within a layer
        ready.sort(key=lambda tid: task_map[tid].priority, reverse=True)
        layers.append(list(ready))

        next_ready = []
        for tid in ready:
            for dependent in dependents.get(tid, set()):
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    next_ready.append(dependent)
        ready = next_ready

    # Check for cycles — any tasks with remaining in_degree > 0
    remaining = [tid for tid, deg in in_degree.items() if deg > 0]
    if remaining:
        logger.error("dependency cycle detected in tasks: %s", remaining)
        # Force remaining tasks into a final layer to avoid deadlock
        layers.append(remaining)

    return layers


class MissionScheduler:
    """DAG-based parallel task scheduler for Harbinger missions.

    Two modes of operation:
    - Production (default): pass llm=, call execute(mission_id) — reads from DB,
      delegates to execute_task, publishes to AgentBus.
    - Testable/injectable: pass execute_fn=, call execute(tasks, mission, llm) —
      drives plain Python objects with no DB dependency.  Used in unit tests and
      for external orchestrators that manage their own state.
    """

    def __init__(self, llm=None, execute_fn=None):
        self._llm = llm
        # execute_fn signature: async (task, mission, llm) -> None
        # When provided, execute() accepts (tasks, mission, llm) instead of (mission_id,)
        self._execute_fn = execute_fn

    # ------------------------------------------------------------------
    # Public entry-point — dispatches based on constructor mode
    # ------------------------------------------------------------------

    async def execute(self, tasks_or_id, mission=None, llm=None) -> str:  # type: ignore[override]
        """Execute a mission's tasks respecting the dependency DAG.

        Injectable mode  (execute_fn provided):
            await sched.execute(tasks: list, mission, llm)
            Tasks are plain objects with .id, .depends_on, .status attributes.

        Production mode (execute_fn not provided):
            await sched.execute(mission_id: int)
            Loads tasks from the database, uses execute_task() internally.
        """
        if self._execute_fn is not None:
            return await self._execute_injectable(tasks_or_id, mission, llm)
        return await self._execute_production(tasks_or_id)

    # ------------------------------------------------------------------
    # Injectable mode — pure asyncio, no DB, used by tests
    # ------------------------------------------------------------------

    async def _execute_injectable(self, tasks: list, mission, llm) -> str:
        """Drive a task list using the injected execute_fn.

        Resolves dependencies dynamically (not layer-by-layer) so that a
        failing task never blocks unrelated siblings — only actual dependents
        are held back.  This matches the behaviour callers expect from the
        test suite.
        """
        task_map = {t.id: t for t in tasks}
        running: dict[int, asyncio.Task] = {}
        completed: set[int] = set()
        failed: set[int] = set()

        while True:
            all_ids = set(task_map)
            if completed | failed >= all_ids:
                break

            # Tasks whose dependencies are all satisfied and that haven't started
            ready = [
                t for t in tasks
                if t.status == "queued"
                and t.id not in running
                and t.id not in completed
                and t.id not in failed
                and all(d in completed for d in (t.depends_on or []))
            ]

            for task in ready:
                task.status = "running"
                running[task.id] = asyncio.create_task(
                    self._injectable_wrap(task, mission, llm)
                )

            if not running:
                # Nothing runnable and nothing pending — stuck (cycle or all done)
                break

            done_futures, _ = await asyncio.wait(
                running.values(), return_when=asyncio.FIRST_COMPLETED
            )

            for future in done_futures:
                tid = self._find_task_id(future, running)
                if tid is None:
                    continue
                running.pop(tid, None)
                exc = future.exception()
                if exc is not None:
                    task_map[tid].status = "failed"
                    task_map[tid].result = str(exc)
                    failed.add(tid)
                    logger.error("task %d failed: %s", tid, exc)
                else:
                    completed.add(tid)

        mission.status = "finished" if not failed else "failed"
        return mission.status

    async def _injectable_wrap(self, task, mission, llm):
        """Call the injected execute_fn; mark task finished on success."""
        await self._execute_fn(task, mission, llm)
        # execute_fn is responsible for setting task.status = "finished"
        # if it doesn't, the scheduler treats the task as done (not failed)
        if task.status not in ("finished", "failed"):
            task.status = "finished"

    @staticmethod
    def _find_task_id(future, running: dict) -> int | None:
        for tid, t in running.items():
            if t is future:
                return tid
        return None

    # ------------------------------------------------------------------
    # Production mode — DB-backed, AgentBus events
    # ------------------------------------------------------------------

    async def _execute_production(self, mission_id: int) -> str:
        """Execute all tasks in a mission respecting the dependency DAG.

        Returns the final mission status: "finished" or "failed".
        """
        if not db.db_available():
            return "failed"

        async with db.get_session()() as session:
            mission = await session.get(Mission, mission_id)
            if not mission:
                return "failed"

            mission.status = "running"
            await session.commit()

            await agent_bus.publish_mission_event(
                mission_id, EVENT_MISSION_UPDATE, "scheduler",
                {"status": "running", "message": "Mission execution started"},
            )

        # Load tasks
        async with db.get_session()() as session:
            from sqlalchemy import select
            result = await session.execute(
                select(Task).where(Task.mission_id == mission_id).order_by(Task.position)
            )
            tasks = list(result.scalars().all())

        if not tasks:
            await self._set_mission_status(mission_id, "finished")
            return "finished"

        # Topological sort into parallel layers
        layers = topological_sort(tasks)
        task_map = {t.id: t for t in tasks}
        completed: set[int] = set()
        failed: set[int] = set()

        for layer_idx, layer_task_ids in enumerate(layers):
            logger.info(
                "mission %d: executing layer %d with %d tasks: %s",
                mission_id, layer_idx, len(layer_task_ids), layer_task_ids,
            )

            # Filter out already completed/skipped tasks
            runnable = [
                tid for tid in layer_task_ids
                if tid in task_map and task_map[tid].status not in ("finished", "skipped")
            ]

            if not runnable:
                continue

            # Check approval gates
            approved_tasks = []
            for tid in runnable:
                task = task_map[tid]
                if task.approval_required:
                    await self._update_task_status(tid, mission_id, "waiting")
                    await agent_bus.publish_mission_event(
                        mission_id, EVENT_TASK_UPDATE, "scheduler",
                        {"task_id": tid, "status": "waiting", "reason": "approval_required"},
                    )
                    approved = await approval_gate.request_approval(tid)
                    if not approved:
                        await self._update_task_status(tid, mission_id, "skipped")
                        continue
                approved_tasks.append(tid)

            # Run all approved tasks in this layer concurrently
            if approved_tasks:
                results = await asyncio.gather(
                    *(self._execute_single_task(tid, task_map[tid], mission_id)
                      for tid in approved_tasks),
                    return_exceptions=True,
                )
                for tid, result in zip(approved_tasks, results):
                    if isinstance(result, Exception):
                        logger.error("task %d raised: %s", tid, result)
                        failed.add(tid)
                        await self._update_task_status(tid, mission_id, "failed")
                    elif result.get("status") == "done":
                        completed.add(tid)
                        await self._save_task_result(tid, result)
                        await self._update_task_status(tid, mission_id, "finished")
                    elif result.get("status") == "waiting":
                        # Task is waiting for user input — leave as waiting
                        await self._update_task_status(tid, mission_id, "waiting")
                    else:
                        failed.add(tid)
                        await self._save_task_result(tid, result)
                        await self._update_task_status(tid, mission_id, "failed")

        # Determine final mission status
        final_status = "finished" if not failed else "failed"
        await self._set_mission_status(mission_id, final_status)
        return final_status

    async def _execute_single_task(
        self, task_id: int, task: Task, mission_id: int
    ) -> dict:
        """Execute a single task and publish events."""
        await self._update_task_status(task_id, mission_id, "running")

        agent = task.agent_codename or "PATHFINDER"
        task_input = ""
        if task.input:
            task_input = task.input.get("task", str(task.input))
        elif task.description:
            task_input = task.description

        return await execute_task(
            task_id=task_id,
            agent_codename=agent,
            docker_image=task.docker_image,
            mission_id=mission_id,
            task_input=task_input,
            llm=self._llm,
        )

    async def _update_task_status(
        self, task_id: int, mission_id: int, status: str
    ) -> None:
        """Update task status in DB and publish to event bus."""
        if db.db_available():
            async with db.get_session()() as session:
                task = await session.get(Task, task_id)
                if task:
                    task.status = status
                    await session.commit()

        await agent_bus.publish_mission_event(
            mission_id, EVENT_TASK_UPDATE, "scheduler",
            {"task_id": task_id, "status": status},
        )

    async def _save_task_result(self, task_id: int, result: dict) -> None:
        """Persist task result to DB."""
        if not db.db_available():
            return
        async with db.get_session()() as session:
            task = await session.get(Task, task_id)
            if task:
                task.result = {
                    "status": result.get("status"),
                    "result": result.get("result", ""),
                    "tokens": result.get("tokens", {}),
                }
                await session.commit()

    async def _set_mission_status(self, mission_id: int, status: str) -> None:
        """Set final mission status."""
        if db.db_available():
            async with db.get_session()() as session:
                mission = await session.get(Mission, mission_id)
                if mission:
                    mission.status = status
                    await session.commit()

        await agent_bus.publish_mission_event(
            mission_id, EVENT_MISSION_UPDATE, "scheduler",
            {"status": status, "message": f"Mission {status}"},
        )
        logger.info("mission %d: %s", mission_id, status)

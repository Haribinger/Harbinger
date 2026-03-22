from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from src.db import async_session, db_available
from src.engine.scheduler import MissionScheduler, approval_gate
from src.models.mission import Mission
from src.models.task import Task

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class MissionCreate(BaseModel):
    title: str
    description: str | None = None
    mission_type: str = "custom"
    target: str | None = None
    scope: dict | None = None
    autonomy_level: int = 1
    trace_id: str | None = None
    user_id: str | None = None


class MissionOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    mission_type: str
    target: str | None
    scope: dict | None
    autonomy_level: int
    trace_id: str | None
    user_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    agent_codename: str | None = None
    docker_image: str | None = None
    depends_on: list[int] = []
    approval_required: bool = False
    priority: int = 0
    input: dict | None = None
    position: int = 0


class TaskOut(BaseModel):
    id: int
    mission_id: int
    title: str
    description: str | None
    status: str
    agent_codename: str | None
    docker_image: str | None
    container_id: str | None
    depends_on: list
    approval_required: bool
    priority: int
    input: dict | None
    result: dict | None
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Mission endpoints
# ---------------------------------------------------------------------------


@router.post("/api/v2/missions", response_model=MissionOut, status_code=201)
async def create_mission(payload: MissionCreate):
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        mission = Mission(**payload.model_dump())
        session.add(mission)
        await session.commit()
        await session.refresh(mission)
        return mission


@router.get("/api/v2/missions", response_model=list[MissionOut])
async def list_missions():
    if not db_available():
        return []

    async with async_session() as session:
        result = await session.execute(
            select(Mission).order_by(Mission.created_at.desc()).limit(100)
        )
        return result.scalars().all()


@router.get("/api/v2/missions/{mission_id}", response_model=MissionOut)
async def get_mission(mission_id: int):
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="mission not found")
        return mission


# ---------------------------------------------------------------------------
# Task CRUD
# ---------------------------------------------------------------------------


@router.get("/api/v2/missions/{mission_id}/tasks", response_model=list[TaskOut])
async def list_tasks(mission_id: int):
    """List all tasks for a mission, ordered by position."""
    if not db_available():
        return []

    async with async_session() as session:
        result = await session.execute(
            select(Task)
            .where(Task.mission_id == mission_id)
            .order_by(Task.position)
        )
        return result.scalars().all()


@router.post(
    "/api/v2/missions/{mission_id}/tasks",
    response_model=TaskOut,
    status_code=201,
)
async def create_task(mission_id: int, payload: TaskCreate):
    """Add a task to a mission's DAG."""
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="mission not found")
        if mission.status not in ("created", "planning"):
            raise HTTPException(
                status_code=400,
                detail=f"cannot add tasks to {mission.status} mission",
            )

        task = Task(mission_id=mission_id, **payload.model_dump())
        session.add(task)
        await session.commit()
        await session.refresh(task)
        return task


@router.get("/api/v2/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: int):
    """Get a single task by ID."""
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        task = await session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")
        return task


@router.patch("/api/v2/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, payload: dict):
    """Update task fields (status, description, priority, etc.)."""
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        task = await session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")

        allowed = {
            "title", "description", "agent_codename", "docker_image",
            "depends_on", "approval_required", "priority", "position",
            "input", "status",
        }
        for key, value in payload.items():
            if key in allowed:
                setattr(task, key, value)

        await session.commit()
        await session.refresh(task)
        return task


@router.delete("/api/v2/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int):
    """Remove a task from the mission DAG."""
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        task = await session.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")
        await session.delete(task)
        await session.commit()


# ---------------------------------------------------------------------------
# Approval gate
# ---------------------------------------------------------------------------


@router.post("/api/v2/tasks/{task_id}/approve")
async def approve_task(task_id: int, payload: dict):
    """Operator approves or denies a task waiting at an approval gate.

    Body: {"approved": true/false}
    """
    approved = payload.get("approved", False)
    if approval_gate.respond(task_id, approved):
        return {"ok": True, "task_id": task_id, "approved": approved}
    raise HTTPException(
        status_code=404,
        detail="no pending approval for this task",
    )


@router.get("/api/v2/approvals/pending")
async def list_pending_approvals():
    """List task IDs currently waiting for operator approval."""
    return {"pending": approval_gate.pending_tasks}


# ---------------------------------------------------------------------------
# Mission templates
# ---------------------------------------------------------------------------


@router.get("/api/v2/missions/templates/list")
async def list_mission_templates():
    from src.engine.templates import list_templates
    return list_templates()


@router.get("/api/v2/missions/templates/{template_name}")
async def get_mission_template(template_name: str):
    from src.engine.templates import get_template
    template = get_template(template_name)
    if not template:
        raise HTTPException(404, f"Template '{template_name}' not found")
    return template


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


@router.post("/api/v2/missions/{mission_id}/execute", status_code=202)
async def execute_mission(mission_id: int, background_tasks: BackgroundTasks):
    """Start executing a mission via the DAG scheduler. Returns immediately."""
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="mission not found")
        if mission.status not in ("created", "failed"):
            raise HTTPException(
                status_code=400,
                detail=f"mission is {mission.status}, cannot execute",
            )

        mission.status = "running"
        await session.commit()

    background_tasks.add_task(_run_mission_scheduler, mission_id)
    return {"status": "started", "mission_id": mission_id}


async def _run_mission_scheduler(mission_id: int):
    """Background: run the DAG scheduler for a mission."""
    from src.agents.llm import LLMAdapter

    llm = LLMAdapter()
    scheduler = MissionScheduler(llm=llm)
    try:
        await scheduler.execute(mission_id)
    except Exception as exc:
        logger.exception("mission %d scheduler crashed: %s", mission_id, exc)
        async with async_session() as session:
            mission = await session.get(Mission, mission_id)
            if mission:
                mission.status = "failed"
                await session.commit()


@router.get("/api/v2/missions/{mission_id}/metrics")
async def mission_metrics(mission_id: int):
    from src.observability.metrics import get_mission_metrics
    return await get_mission_metrics(mission_id)


import logging

logger = logging.getLogger(__name__)

"""
War Room router — real-time mission coordination, agent monitoring,
command injection, and task reassignment.

Endpoints:
  GET  /api/v2/warroom/{mission_id}/state   Mission state (task DAG + agent statuses)
  GET  /api/v2/warroom/{mission_id}/stream  SSE event stream
  GET  /api/v2/warroom/{mission_id}/events  Recent events from ring buffer
  POST /api/v2/warroom/{mission_id}/inject  Inject command into agent container
  POST /api/v2/warroom/{mission_id}/reassign  Reassign a task to a different agent
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from src.db import async_session, db_available
from src.models.mission import Mission
from src.models.task import Task
from src.warroom.bus import (
    EVENT_OPERATOR_ACTION,
    EVENT_SYSTEM_ALERT,
    EVENT_TASK_UPDATE,
    BusEvent,
    _gen_id,
    agent_bus,
)
from src.warroom.stream import create_sse_response

router = APIRouter(prefix="/api/v2/warroom", tags=["warroom"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class InjectCommand(BaseModel):
    agent_codename: str
    command: str
    workdir: str = "/work"
    timeout: int = 300


class ReassignTask(BaseModel):
    task_id: int
    new_agent: str
    reason: str = ""


class AgentStatusOut(BaseModel):
    codename: str
    status: str
    current_task: str | None = None
    container_id: str | None = None


class TaskOut(BaseModel):
    id: int
    title: str
    status: str
    agent_codename: str
    depends_on: list[int] = []
    position: int = 0

    model_config = {"from_attributes": True}


class MissionStateOut(BaseModel):
    mission_id: int
    title: str
    status: str
    tasks: list[TaskOut]
    agents: list[AgentStatusOut]
    subscriber_count: int
    event_count: int


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/{mission_id}/state", response_model=MissionStateOut)
async def get_mission_state(mission_id: int):
    """Get the full War Room state: task DAG and agent statuses."""
    if not db_available():
        raise HTTPException(503, detail="database not available")

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if not mission:
            raise HTTPException(404, detail=f"mission {mission_id} not found")

        result = await session.execute(
            select(Task)
            .where(Task.mission_id == mission_id)
            .order_by(Task.position)
        )
        tasks = result.scalars().all()

    # Derive agent statuses from tasks
    agent_map: dict[str, AgentStatusOut] = {}
    for task in tasks:
        codename = task.agent_codename
        if codename not in agent_map:
            agent_map[codename] = AgentStatusOut(
                codename=codename,
                status="idle",
            )
        if task.status == "running":
            agent_map[codename].status = "executing"
            agent_map[codename].current_task = task.title
            agent_map[codename].container_id = task.container_id

    task_outs = []
    for t in tasks:
        deps = t.depends_on if t.depends_on else []
        task_outs.append(
            TaskOut(
                id=t.id,
                title=t.title,
                status=t.status,
                agent_codename=t.agent_codename,
                depends_on=deps,
                position=t.position,
            )
        )

    return MissionStateOut(
        mission_id=mission_id,
        title=mission.title,
        status=mission.status,
        tasks=task_outs,
        agents=list(agent_map.values()),
        subscriber_count=agent_bus.subscriber_count,
        event_count=agent_bus.event_count,
    )


@router.get("/{mission_id}/stream")
async def stream_mission_events(mission_id: int, request: Request):
    """SSE stream of all events for a mission."""
    return create_sse_response(
        bus=agent_bus,
        channel=f"mission:{mission_id}",
        request=request,
    )


@router.get("/{mission_id}/events")
async def get_recent_events(mission_id: int, limit: int = 50):
    """Get recent events from the ring buffer."""
    events = await agent_bus.get_recent(
        channel=f"mission:{mission_id}", limit=min(limit, 200)
    )
    return {"ok": True, "events": [e.to_dict() for e in events]}


@router.post("/{mission_id}/inject")
async def inject_command(mission_id: int, body: InjectCommand):
    """Inject a manual command into an agent's container."""
    # Publish the inject event — the executor picks it up
    await agent_bus.publish(
        BusEvent(
            id=_gen_id("inject"),
            type=EVENT_OPERATOR_ACTION,
            source="operator",
            target=body.agent_codename,
            channel=f"mission:{mission_id}",
            payload={
                "action": "inject_command",
                "command": body.command,
                "workdir": body.workdir,
                "timeout": body.timeout,
                "agent": body.agent_codename,
            },
        )
    )

    return {
        "ok": True,
        "message": f"command injected for {body.agent_codename}",
        "command": body.command,
    }


@router.post("/{mission_id}/reassign")
async def reassign_task(mission_id: int, body: ReassignTask):
    """Reassign a task to a different agent."""
    if not db_available():
        raise HTTPException(503, detail="database not available")

    async with async_session() as session:
        task = await session.get(Task, body.task_id)
        if not task:
            raise HTTPException(404, detail=f"task {body.task_id} not found")
        if task.mission_id != mission_id:
            raise HTTPException(400, detail="task does not belong to this mission")
        if task.status == "running":
            raise HTTPException(
                409, detail="cannot reassign a running task — stop it first"
            )

        old_agent = task.agent_codename
        task.agent_codename = body.new_agent
        task.status = "queued"
        await session.commit()

    # Notify via bus
    await agent_bus.publish(
        BusEvent(
            id=_gen_id("reassign"),
            type=EVENT_TASK_UPDATE,
            source="operator",
            target=body.new_agent,
            channel=f"mission:{mission_id}",
            payload={
                "action": "task_reassigned",
                "task_id": body.task_id,
                "old_agent": old_agent,
                "new_agent": body.new_agent,
                "reason": body.reason,
            },
        )
    )

    return {
        "ok": True,
        "message": f"task {body.task_id} reassigned from {old_agent} to {body.new_agent}",
    }

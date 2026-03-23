"""Workflow API — CRUD + execution for visual workflow DAGs."""
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from src.engine.workflow import (
    delete_workflow,
    get_workflow,
    list_workflows,
    parse_workflow,
    save_workflow,
    workflow_to_tasks,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/workflows", tags=["workflows"])


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    nodes: list[dict]
    edges: list[dict]


class WorkflowExecute(BaseModel):
    target: str = ""
    # "manual" (0), "supervised" (1), "autonomous" (2) — maps to Mission.autonomy_level int
    autonomy_level: str = "supervised"


_AUTONOMY_MAP = {"manual": 0, "supervised": 1, "autonomous": 2}


@router.post("", status_code=201)
async def create_workflow(body: WorkflowCreate):
    wf = parse_workflow(body.model_dump())
    save_workflow(wf)
    return wf.to_dict()


@router.get("")
async def list_all_workflows():
    return {"workflows": list_workflows()}


@router.get("/{workflow_id}")
async def get_workflow_detail(workflow_id: str):
    wf = get_workflow(workflow_id)
    if not wf:
        raise HTTPException(404, "Workflow not found")
    return wf.to_dict()


@router.put("/{workflow_id}")
async def update_workflow(workflow_id: str, body: WorkflowCreate):
    existing = get_workflow(workflow_id)
    if not existing:
        raise HTTPException(404, "Workflow not found")
    data = body.model_dump()
    data["id"] = workflow_id
    wf = parse_workflow(data)
    save_workflow(wf)
    return wf.to_dict()


@router.delete("/{workflow_id}")
async def remove_workflow(workflow_id: str):
    if not get_workflow(workflow_id):
        raise HTTPException(404, "Workflow not found")
    delete_workflow(workflow_id)
    return {"status": "deleted", "id": workflow_id}


@router.post("/{workflow_id}/execute", status_code=202)
async def execute_workflow(
    workflow_id: str, body: WorkflowExecute, background_tasks: BackgroundTasks
):
    """Convert workflow to a Mission+Tasks and hand off to the DAG scheduler."""
    wf = get_workflow(workflow_id)
    if not wf:
        raise HTTPException(404, "Workflow not found")

    from src.db import db_available, get_session

    if not db_available():
        raise HTTPException(503, "Database not available")

    from src.models.mission import Mission
    from src.models.task import Task

    autonomy_int = _AUTONOMY_MAP.get(body.autonomy_level, 1)

    async with get_session()() as session:
        mission = Mission(
            title=f"Workflow: {wf.name}",
            description=wf.description or None,
            mission_type="workflow",
            target=body.target or None,
            autonomy_level=autonomy_int,
            user_id="system",
        )
        session.add(mission)
        await session.commit()
        await session.refresh(mission)

        task_dicts = workflow_to_tasks(wf, mission.id, body.target)

        for td in task_dicts:
            task = Task(
                mission_id=mission.id,
                title=td["title"],
                description=td.get("description") or None,
                agent_codename=td["agent_codename"],
                docker_image=td.get("docker_image"),
                depends_on=td.get("depends_on_positions", []),
                approval_required=td.get("approval_required", False),
                position=td["position"],
                status="queued",
                input=td.get("input"),
            )
            session.add(task)

        await session.commit()

    # Schedule execution as a background task — mirrors missions.py execute_mission
    from src.routers.missions import _run_mission_scheduler

    background_tasks.add_task(_run_mission_scheduler, mission.id)

    return {
        "status": "started",
        "mission_id": mission.id,
        "workflow_id": workflow_id,
        "tasks_created": len(task_dicts),
    }


@router.post("/{workflow_id}/preview")
async def preview_workflow(workflow_id: str, body: WorkflowExecute):
    """Preview what tasks would be created without executing."""
    wf = get_workflow(workflow_id)
    if not wf:
        raise HTTPException(404, "Workflow not found")

    tasks = workflow_to_tasks(wf, mission_id=0, target=body.target)
    return {
        "workflow": wf.name,
        "target": body.target,
        "tasks": tasks,
        "task_count": len(tasks),
    }

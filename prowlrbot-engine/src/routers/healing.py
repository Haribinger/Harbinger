"""Healing API — self-healing status, events, manual interventions."""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/healing", tags=["healing"])


@router.get("/status")
async def healing_status():
    from src.healing.monitor import healing_monitor
    events = healing_monitor.get_events(limit=10)
    active = [e for e in events if e.get("type") in ("container_failure", "stall", "timeout")]
    return {"active_interventions": len(active), "recent_events": events}


@router.get("/events")
async def healing_events(limit: int = 50):
    from src.healing.monitor import healing_monitor
    return {"events": healing_monitor.get_events(limit=limit)}


class RestartRequest(BaseModel):
    reason: str = "manual restart"

@router.post("/restart/{task_id}")
async def restart_task(task_id: int, body: RestartRequest):
    """Restart a task's container via Docker API."""
    from src.healing.monitor import healing_monitor
    import src.db as db

    healing_monitor.record_event(task_id, "manual", "restart", {"reason": body.reason})

    # Look up the container_id from the task
    session_factory = db.get_session()
    if session_factory is None:
        raise HTTPException(503, "Database not available — cannot look up task container")

    from src.models.task import Task
    async with session_factory() as session:
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(404, f"Task {task_id} not found")
        if not task.container_id:
            raise HTTPException(400, f"Task {task_id} has no running container")

    # Restart via Docker API
    from src.docker.client import DockerClient
    try:
        async with DockerClient() as docker:
            if not await docker.ping():
                raise HTTPException(503, "Docker daemon not reachable")
            # Docker API: POST /containers/{id}/restart
            resp = await docker._http.post(
                f"/v1.41/containers/{task.container_id}/restart",
                params={"t": 10},
            )
            if resp.status_code == 404:
                raise HTTPException(404, f"Container {task.container_id} not found")
            if resp.status_code not in (204,):
                raise HTTPException(502, f"Docker restart failed: {resp.status_code} {resp.text}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Container restart failed for task %d: %s", task_id, exc)
        raise HTTPException(502, f"Container restart failed: {exc}")

    return {"status": "restarted", "task_id": task_id, "container_id": task.container_id}

"""Healing API — self-healing status, events, manual interventions."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
    from src.healing.monitor import healing_monitor
    healing_monitor.record_event(task_id, "manual", "restart", {"reason": body.reason})
    # Actual container restart is handled by the scheduler
    return {"status": "restart_requested", "task_id": task_id}

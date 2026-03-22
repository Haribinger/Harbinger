"""Kill switch + approval gate REST API."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2", tags=["safety"])


# === Kill Switch ===

class KillRequest(BaseModel):
    reason: str = "operator action"

@router.get("/killswitch/status")
async def killswitch_status():
    from src.engine.killswitch import kill_switch
    return kill_switch.status

@router.post("/killswitch/activate")
async def activate_global(body: KillRequest):
    from src.engine.killswitch import kill_switch
    kill_switch.activate_global(body.reason)
    return {"status": "activated", "reason": body.reason}

@router.post("/killswitch/deactivate")
async def deactivate_global():
    from src.engine.killswitch import kill_switch
    kill_switch.deactivate_global()
    return {"status": "deactivated"}

@router.post("/killswitch/halt/mission/{mission_id}")
async def halt_mission(mission_id: int, body: KillRequest):
    from src.engine.killswitch import kill_switch
    kill_switch.halt_mission(mission_id, body.reason)
    return {"status": "halted", "mission_id": mission_id}

@router.post("/killswitch/halt/agent/{codename}")
async def halt_agent(codename: str, body: KillRequest):
    from src.engine.killswitch import kill_switch
    kill_switch.halt_agent(codename, body.reason)
    return {"status": "halted", "agent": codename}

@router.get("/killswitch/events")
async def killswitch_events(limit: int = 50):
    from src.engine.killswitch import kill_switch
    return {"events": kill_switch.get_events(limit)}


# === Approval Gates ===

class ApprovalDecision(BaseModel):
    approved_by: str = "operator"

@router.get("/approvals/pending")
async def pending_approvals():
    from src.engine.approval import approval_gate
    return {"pending": approval_gate.get_pending()}

@router.post("/approvals/{task_id}/approve")
async def approve_task(task_id: int, body: ApprovalDecision):
    from src.engine.approval import approval_gate
    if approval_gate.approve(task_id, body.approved_by):
        return {"status": "approved", "task_id": task_id}
    raise HTTPException(404, "No pending approval for this task")

@router.post("/approvals/{task_id}/deny")
async def deny_task(task_id: int, body: ApprovalDecision):
    from src.engine.approval import approval_gate
    if approval_gate.deny(task_id, body.approved_by):
        return {"status": "denied", "task_id": task_id}
    raise HTTPException(404, "No pending approval for this task")

@router.get("/approvals/history")
async def approval_history(limit: int = 50):
    from src.engine.approval import approval_gate
    return {"history": approval_gate.get_all(limit)}

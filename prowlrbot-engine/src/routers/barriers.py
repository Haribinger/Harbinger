import src.engine.ask_barrier as ask_barrier_module
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/barriers", tags=["barriers"])


class RespondRequest(BaseModel):
    response: str


@router.get("/pending")
async def list_pending_barriers():
    """List all pending ask-user barriers."""
    return {"ok": True, "items": ask_barrier_module.ask_barrier.list_pending()}


@router.post("/{subtask_id}/respond")
async def respond_to_barrier(subtask_id: str, body: RespondRequest):
    """Deliver operator response to a pending barrier."""
    if ask_barrier_module.ask_barrier.respond(subtask_id, body.response):
        return {"ok": True, "subtask_id": subtask_id}
    raise HTTPException(404, detail=f"No pending barrier for subtask {subtask_id}")


@router.get("/{subtask_id}")
async def get_barrier(subtask_id: str):
    """Get details of a specific pending barrier."""
    b = ask_barrier_module.ask_barrier.get_pending(subtask_id)
    if not b:
        raise HTTPException(404, detail=f"No pending barrier for subtask {subtask_id}")
    return {
        "ok": True,
        "barrier": {
            "subtask_id": b.subtask_id,
            "mission_id": b.mission_id,
            "agent_codename": b.agent_codename,
            "question": b.question,
            "options": b.options,
            "created_at": b.created_at,
        },
    }

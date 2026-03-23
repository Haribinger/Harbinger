"""License API — check, activate, and manage license keys."""
from fastapi import APIRouter
from pydantic import BaseModel

from src.license import validate_key, save_license, load_license, get_current_license, TIERS

router = APIRouter(prefix="/api/v2/license", tags=["license"])


class ActivateRequest(BaseModel):
    key: str


@router.get("/status")
async def license_status():
    """Get current license status."""
    return get_current_license()


@router.post("/activate")
async def activate_license(body: ActivateRequest):
    """Activate a license key."""
    result = validate_key(body.key)
    if result.valid:
        save_license(body.key)
        return {"status": "activated", **result.to_dict()}
    return {"status": "invalid", "reason": "Key validation failed", **result.to_dict()}


@router.get("/tiers")
async def list_tiers():
    """List available license tiers."""
    return {"tiers": [
        {"id": tid, **tinfo}
        for tid, tinfo in TIERS.items()
    ]}

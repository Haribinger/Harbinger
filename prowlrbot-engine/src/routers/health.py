from fastapi import APIRouter
from fastapi.responses import JSONResponse

from src.db import db_available

router = APIRouter()


@router.get("/health")
@router.get("/api/v2/health")
async def health():
    status = "ok" if db_available() else "degraded"
    checks = {"status": status, "service": "harbinger-engine"}

    if db_available():
        checks["postgres"] = "connected"
    else:
        checks["postgres"] = "disconnected"

    # Always 200 — callers check the status field. Returning 503 would cause
    # load balancers and Docker health checks to mark the container unhealthy
    # just because postgres is temporarily unreachable.
    return JSONResponse(checks, status_code=200)

"""Migration status — tracks Go sunset progress.

Part of the Go sunset (Phase 9). This endpoint gives operators a live
view of how many /api/ routes have been moved from Go to FastAPI.

Update MIGRATED_ROUTES each time a new compat route is added to compat.py.
Update TOTAL_GO_ROUTES if new Go routes are added during the migration window.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v2/migration", tags=["migration"])

# Routes migrated from Go to FastAPI (served by compat.py under /api/).
# Each entry records the canonical /api/ path, accepted HTTP methods,
# and the FastAPI source file that owns the handler logic.
MIGRATED_ROUTES: list[dict] = [
    {
        "path": "/api/missions",
        "methods": ["POST"],
        "source": "missions.py",
        "go_handler": "handleCreateMission",
    },
    {
        "path": "/api/missions",
        "methods": ["GET"],
        "source": "missions.py",
        "go_handler": "handleListMissions",
    },
    {
        "path": "/api/missions/{id}",
        "methods": ["GET"],
        "source": "missions.py",
        "go_handler": "handleGetMission",
    },
    {
        "path": "/api/barriers/pending",
        "methods": ["GET"],
        "source": "barriers.py",
        "go_handler": "handleListBarriers",
    },
    {
        "path": "/api/barriers/{id}/respond",
        "methods": ["POST"],
        "source": "barriers.py",
        "go_handler": "handleRespondToBarrier",
    },
    {
        "path": "/api/barriers/{id}",
        "methods": ["GET"],
        "source": "barriers.py",
        "go_handler": "handleGetBarrier",
    },
    {
        "path": "/api/healing/status",
        "methods": ["GET"],
        "source": "healing.py",
        "go_handler": "handleHealingStatus",
    },
    {
        "path": "/api/healing/events",
        "methods": ["GET"],
        "source": "healing.py",
        "go_handler": "handleHealingEvents",
    },
]

# Approximate total of registered Go routes across all 18 handler files.
# Source: backend/cmd/ route count as of v2.0 migration start.
TOTAL_GO_ROUTES = 375


@router.get("/status")
async def migration_status():
    """Return current Go sunset migration progress."""
    # Count unique paths (a path with GET + POST counts as 2 towards migration)
    migrated = len(MIGRATED_ROUTES)
    return {
        "ok": True,
        "migrated_routes": migrated,
        "total_go_routes": TOTAL_GO_ROUTES,
        "progress_percent": round(migrated / TOTAL_GO_ROUTES * 100, 1),
        "routes": MIGRATED_ROUTES,
    }

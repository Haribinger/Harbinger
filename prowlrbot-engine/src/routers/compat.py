"""Compatibility router — exposes v2 endpoints under /api/ prefix for frontend.

Part of the Go sunset (Phase 9). Each route here replaces a Go handler.
When all routes are migrated, the Go backend can be decommissioned.

The route functions are imported directly from their v2 routers and
re-registered here under the /api/ prefix. FastAPI binds each function
to the new path declaration — the original v2 decorator path is ignored.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["compat-v1"])


# ---------------------------------------------------------------------------
# Missions  (missions.py — functions verified)
# ---------------------------------------------------------------------------

from src.routers.missions import (
    create_mission,
    list_missions,
    get_mission,
)

router.post("/missions", response_model=None, status_code=201)(create_mission)
router.get("/missions", response_model=None)(list_missions)
router.get("/missions/{mission_id}", response_model=None)(get_mission)


# ---------------------------------------------------------------------------
# Barriers  (barriers.py — functions verified)
# ---------------------------------------------------------------------------

from src.routers.barriers import (
    list_pending_barriers,
    respond_to_barrier,
    get_barrier,
)

router.get("/barriers/pending", response_model=None)(list_pending_barriers)
router.post("/barriers/{subtask_id}/respond", response_model=None)(respond_to_barrier)
router.get("/barriers/{subtask_id}", response_model=None)(get_barrier)


# ---------------------------------------------------------------------------
# Healing  (healing.py — functions verified)
# Note: functions are named healing_status / healing_events in the source.
# ---------------------------------------------------------------------------

from src.routers.healing import (
    healing_status,
    healing_events,
)

router.get("/healing/status", response_model=None)(healing_status)
router.get("/healing/events", response_model=None)(healing_events)


# ---------------------------------------------------------------------------
# Memory  (memory.py — functions verified; get_memory_stats does not exist)
# These keep the /v2/ infix so the frontend can opt in to the new paths
# without conflicting with any existing Go /api/memory/* routes.
# ---------------------------------------------------------------------------

from src.routers.memory import (
    search_memory,
    store_memory,
)

router.get("/v2/memory/search", response_model=None)(search_memory)
router.post("/v2/memory/store", response_model=None)(store_memory)


# ---------------------------------------------------------------------------
# Registry  (registry.py — functions verified)
# These keep the /v2/ infix so they don't shadow Go /api/agents/* routes
# that are not yet migrated.
# ---------------------------------------------------------------------------

from src.routers.registry import (
    list_agents as reg_list_agents,
    get_agent as reg_get_agent,
    list_settings,
)

router.get("/v2/registry/agents", response_model=None)(reg_list_agents)
router.get("/v2/registry/agents/{codename}", response_model=None)(reg_get_agent)
router.get("/v2/registry/settings", response_model=None)(list_settings)

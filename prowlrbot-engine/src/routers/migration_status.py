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
# Routes that nginx sends to FastAPI instead of Go.
# Includes both /api/v2/* (new) and /api/* routes proxied to FastAPI.
FASTAPI_ROUTE_GROUPS: list[dict] = [
    # v2 native — built from scratch in FastAPI
    {"prefix": "/api/v2/missions", "router": "missions.py", "routes": 12, "status": "native"},
    {"prefix": "/api/v2/tasks", "router": "tasks.py", "routes": 4, "status": "native"},
    {"prefix": "/api/v2/warroom", "router": "warroom.py", "routes": 5, "status": "native"},
    {"prefix": "/api/v2/healing", "router": "healing.py", "routes": 4, "status": "native"},
    {"prefix": "/api/v2/memory", "router": "memory.py", "routes": 6, "status": "native"},
    {"prefix": "/api/v2/tools", "router": "tools.py", "routes": 4, "status": "native"},
    {"prefix": "/api/v2/hub", "router": "hub.py", "routes": 15, "status": "native"},
    {"prefix": "/api/v2/registry", "router": "registry.py", "routes": 8, "status": "native"},
    {"prefix": "/api/v2/health", "router": "health.py", "routes": 1, "status": "native"},
    {"prefix": "/api/v2/channels", "router": "channels.py", "routes": 3, "status": "native"},
    {"prefix": "/api/v2/killswitch", "router": "killswitch.py", "routes": 2, "status": "native"},
    {"prefix": "/api/v2/community", "router": "community.py", "routes": 3, "status": "native"},
    {"prefix": "/api/v2/workflows", "router": "workflows.py", "routes": 4, "status": "native"},
    {"prefix": "/api/v2/nuclei-ide", "router": "nuclei_ide.py", "routes": 5, "status": "native"},
    {"prefix": "/api/v2/license", "router": "license.py", "routes": 4, "status": "native"},
    {"prefix": "/api/v2/migration", "router": "migration_status.py", "routes": 1, "status": "native"},
    # /api/ routes proxied from Go to FastAPI via nginx
    {"prefix": "/api/missions", "router": "missions.py", "routes": 3, "status": "migrated"},
    {"prefix": "/api/barriers", "router": "barriers.py", "routes": 3, "status": "migrated"},
    {"prefix": "/api/healing", "router": "healing.py", "routes": 2, "status": "migrated"},
]

# Go route groups that remain on the Go backend (no migration needed — stable CRUD)
GO_ONLY_GROUPS: list[dict] = [
    {"prefix": "/api/agents", "handler": "agents.go", "routes": 30, "reason": "stable CRUD, no active dev"},
    {"prefix": "/api/autonomous", "handler": "autonomous.go", "routes": 12, "reason": "v1 thinking loop"},
    {"prefix": "/api/auth", "handler": "oauth.go", "routes": 16, "reason": "JWT issuer must stay in Go"},
    {"prefix": "/api/browser", "handler": "browsers.go", "routes": 12, "reason": "CDP sessions"},
    {"prefix": "/api/c2", "handler": "c2.go", "routes": 28, "reason": "stable C2 infrastructure"},
    {"prefix": "/api/chat", "handler": "chat.go", "routes": 7, "reason": "agent messaging"},
    {"prefix": "/api/cve", "handler": "cve.go", "routes": 14, "reason": "CISA KEV feed"},
    {"prefix": "/api/dashboard", "handler": "main.go", "routes": 9, "reason": "overview metrics"},
    {"prefix": "/api/docker", "handler": "main.go", "routes": 8, "reason": "container management"},
    {"prefix": "/api/lol", "handler": "lol.go", "routes": 12, "reason": "LOL integration"},
    {"prefix": "/api/mcp", "handler": "main.go", "routes": 6, "reason": "MCP server management"},
    {"prefix": "/api/pentest", "handler": "pentest.go", "routes": 6, "reason": "pentest dashboard"},
    {"prefix": "/api/providers", "handler": "modelrouter.go", "routes": 11, "reason": "model routing"},
    {"prefix": "/api/realtime", "handler": "realtime.go", "routes": 16, "reason": "SSE hub (single fan-out point)"},
    {"prefix": "/api/roar", "handler": "roar_handlers.go", "routes": 7, "reason": "ROAR bus (Go-native)"},
    {"prefix": "/api/safety", "handler": "safety.go", "routes": 12, "reason": "also in Python, Go is legacy"},
    {"prefix": "/api/scope", "handler": "main.go", "routes": 6, "reason": "target scope management"},
    {"prefix": "/api/settings", "handler": "main.go", "routes": 4, "reason": "app settings"},
    {"prefix": "/api/skills", "handler": "skills.go", "routes": 4, "reason": "skill execution"},
    {"prefix": "/api/themes", "handler": "themes.go", "routes": 8, "reason": "UI themes"},
]

TOTAL_GO_ROUTES = 377
TOTAL_FASTAPI_ROUTES = sum(g["routes"] for g in FASTAPI_ROUTE_GROUPS)


@router.get("/status")
async def migration_status():
    """Return Go sunset migration progress.

    The Strangler Fig pattern: new features go to FastAPI (/api/v2/*),
    stable Go routes stay on Go (/api/*). No need to migrate everything —
    only routes with active development move.
    """
    migrated = [g for g in FASTAPI_ROUTE_GROUPS if g["status"] == "migrated"]
    native = [g for g in FASTAPI_ROUTE_GROUPS if g["status"] == "native"]

    return {
        "ok": True,
        "strategy": "strangler_fig",
        "summary": {
            "go_routes": TOTAL_GO_ROUTES,
            "fastapi_routes": TOTAL_FASTAPI_ROUTES,
            "fastapi_native": sum(g["routes"] for g in native),
            "fastapi_migrated": sum(g["routes"] for g in migrated),
            "go_only": sum(g["routes"] for g in GO_ONLY_GROUPS),
        },
        "fastapi_groups": FASTAPI_ROUTE_GROUPS,
        "go_only_groups": GO_ONLY_GROUPS,
        "phase": "Phase 9 — Go sunset (Strangler Fig)",
        "status": "Dual-backend operational. New features → FastAPI. Stable CRUD → Go.",
    }

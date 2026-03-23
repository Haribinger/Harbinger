from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import src.db as _db
from src.db import close_db, init_db
from src.routers.barriers import router as barriers_router
from src.routers.channels import router as channels_router
from src.routers.compat import router as compat_router
from src.routers.health import router as health_router
from src.routers.healing import router as healing_router
from src.routers.migration_status import router as migration_status_router
from src.routers.missions import router as missions_router
from src.routers.tasks import router as tasks_router
from src.routers.warroom import router as warroom_router
from src.routers.memory import router as memory_router
from src.routers.killswitch import router as killswitch_router
from src.routers.tools import router as tools_router
from src.routers.registry import router as registry_router
from src.routers.nuclei_ide import router as nuclei_ide_router
from src.routers.community import router as community_router
from src.routers.workflows import router as workflows_router
from src.channels.setup import setup_channel_bridge


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_channel_bridge()
    await init_db()

    # Create all SQLAlchemy-managed tables when the DB is reachable.
    # Safe to call repeatedly — CREATE TABLE IF NOT EXISTS semantics.
    if _db.engine:
        from src.models import Base  # local import avoids circular deps at module load

        async with _db.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Register built-in mission templates in the template registry
    from src.engine.templates import MISSION_TEMPLATES
    from src.registry.templates import template_registry, MissionTemplate
    for tid, tmpl in MISSION_TEMPLATES.items():
        template_registry.register_builtin(MissionTemplate(
            id=tid, name=tmpl["name"], description=tmpl.get("description", ""),
            default_autonomy=tmpl.get("default_autonomy", "supervised"),
            continuous=tmpl.get("continuous", False),
            scan_interval=tmpl.get("scan_interval", 3600),
            tasks=tmpl.get("tasks", []),
        ))

    yield
    # Shutdown
    await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Harbinger Engine",
        description="Autonomous Security Operating System — Execution Engine",
        version="2.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(barriers_router)
    app.include_router(channels_router)
    # compat_router must be included BEFORE the canonical v2 routers so that
    # FastAPI's OpenAPI schema lists the /api/ paths separately.  Route
    # resolution is still correct because each path is unique.
    app.include_router(compat_router)
    app.include_router(health_router)
    app.include_router(healing_router)
    app.include_router(migration_status_router)
    app.include_router(missions_router)
    app.include_router(tasks_router)
    app.include_router(warroom_router)
    app.include_router(memory_router)
    app.include_router(killswitch_router)
    app.include_router(tools_router)
    app.include_router(registry_router)
    app.include_router(nuclei_ide_router)
    app.include_router(community_router)
    app.include_router(workflows_router)

    return app


app = create_app()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db import close_db, engine, init_db
from src.routers.health import router as health_router
from src.routers.missions import router as missions_router
from src.routers.tasks import router as tasks_router
from src.routers.warroom import router as warroom_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()

    # Create all SQLAlchemy-managed tables when the DB is reachable.
    # Safe to call repeatedly — CREATE TABLE IF NOT EXISTS semantics.
    if engine:
        from src.models import Base  # local import avoids circular deps at module load

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

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

    app.include_router(health_router)
    app.include_router(missions_router)
    app.include_router(tasks_router)
    app.include_router(warroom_router)

    return app


app = create_app()

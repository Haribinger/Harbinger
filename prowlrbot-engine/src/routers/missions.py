from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from src.db import async_session, db_available
from src.models.mission import Mission

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class MissionCreate(BaseModel):
    title: str
    description: str | None = None
    mission_type: str = "custom"
    target: str | None = None
    scope: dict | None = None
    autonomy_level: int = 1
    trace_id: str | None = None
    user_id: str | None = None


class MissionOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    mission_type: str
    target: str | None
    scope: dict | None
    autonomy_level: int
    trace_id: str | None
    user_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/api/v2/missions", response_model=MissionOut, status_code=201)
async def create_mission(payload: MissionCreate):
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        mission = Mission(**payload.model_dump())
        session.add(mission)
        await session.commit()
        await session.refresh(mission)
        return mission


@router.get("/api/v2/missions", response_model=list[MissionOut])
async def list_missions():
    if not db_available():
        return []

    async with async_session() as session:
        result = await session.execute(
            select(Mission).order_by(Mission.created_at.desc()).limit(100)
        )
        return result.scalars().all()


@router.get("/api/v2/missions/{mission_id}", response_model=MissionOut)
async def get_mission(mission_id: int):
    if not db_available():
        raise HTTPException(status_code=503, detail="database not available")

    async with async_session() as session:
        mission = await session.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=404, detail="mission not found")
        return mission

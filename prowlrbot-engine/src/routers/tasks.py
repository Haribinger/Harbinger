from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from src.db import async_session, db_available
from src.models.task import Task
from src.models.subtask import SubTask

router = APIRouter(prefix="/api/v2/tasks", tags=["tasks"])


class TaskResponse(BaseModel):
    id: int
    mission_id: int
    title: str
    status: str
    agent_codename: str
    position: int

    class Config:
        from_attributes = True


@router.get("/mission/{mission_id}", response_model=list[TaskResponse])
async def list_mission_tasks(mission_id: int):
    if not db_available():
        return []
    async with async_session() as session:
        result = await session.execute(
            select(Task).where(Task.mission_id == mission_id).order_by(Task.position)
        )
        return result.scalars().all()


@router.get("/{task_id}")
async def get_task(task_id: int):
    if not db_available():
        raise HTTPException(503)
    async with async_session() as session:
        task = await session.get(Task, task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        subtasks = await session.execute(
            select(SubTask).where(SubTask.task_id == task_id).order_by(SubTask.position)
        )
        return {
            "task": TaskResponse.model_validate(task),
            "subtasks": [
                {"id": s.id, "title": s.title, "status": s.status, "result": s.result}
                for s in subtasks.scalars()
            ],
        }

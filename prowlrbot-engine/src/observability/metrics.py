"""Mission metrics — real-time stats for dashboard."""
from sqlalchemy import select, func
from src.db import db_available, get_session
from src.models.action import Action
from src.models.task import Task
from src.models.subtask import SubTask


async def get_mission_metrics(mission_id: int) -> dict:
    if not db_available():
        return {"error": "db_unavailable"}

    session_factory = get_session()
    if session_factory is None:
        return {"error": "db_unavailable"}

    async with session_factory() as session:
        # Task counts by status
        task_rows = await session.execute(
            select(Task.status, func.count()).where(Task.mission_id == mission_id).group_by(Task.status)
        )
        task_counts = {row[0]: row[1] for row in task_rows}

        # Total actions + avg duration
        action_stats = await session.execute(
            select(
                func.count(Action.id),
                func.sum(Action.duration_seconds),
                func.avg(Action.duration_seconds),
            ).where(Action.mission_id == mission_id)
        )
        row = action_stats.first()
        total_actions = row[0] or 0
        total_duration = row[1] or 0
        avg_duration = row[2] or 0

        # Tool call breakdown
        tool_rows = await session.execute(
            select(Action.tool_name, func.count()).where(Action.mission_id == mission_id).group_by(Action.tool_name)
        )
        tool_counts = {row[0]: row[1] for row in tool_rows}

        return {
            "mission_id": mission_id,
            "tasks": task_counts,
            "total_actions": total_actions,
            "total_duration_s": round(total_duration, 2),
            "avg_action_duration_s": round(avg_duration, 2),
            "tool_calls": tool_counts,
        }

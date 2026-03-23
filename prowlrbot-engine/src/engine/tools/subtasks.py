"""Subtask management tools — agents can generate and modify their own subtask lists."""
import logging

from sqlalchemy import select

logger = logging.getLogger(__name__)


class SubtaskListTool:
    """Agent generates a new subtask list and persists to the DB."""

    def __init__(self, task_id: int | None = None):
        self._task_id = task_id

    async def execute(self, args: dict) -> str:
        subtasks = args.get("subtasks", [])
        if not subtasks:
            return "Error: subtasks list is empty"

        if self._task_id is None:
            return "Error: no task_id set — cannot persist subtasks"

        import src.db as db
        session_factory = db.get_session()
        if session_factory is None:
            return "Error: database not available — subtasks not persisted"

        from src.models.subtask import SubTask

        created = []
        try:
            async with session_factory() as session:
                for i, st in enumerate(subtasks):
                    title = st.get("title", f"Subtask {i}")
                    desc = st.get("description", "")
                    row = SubTask(
                        task_id=self._task_id,
                        title=title,
                        description=desc,
                        status="created",
                        position=i,
                    )
                    session.add(row)
                    created.append(f"{i+1}. {title}: {desc}")
                await session.commit()
        except Exception as exc:
            logger.error("Failed to persist subtasks for task %d: %s", self._task_id, exc)
            return f"Error persisting subtasks: {exc}"

        return f"Subtask plan created ({len(created)} subtasks persisted):\n" + "\n".join(created)

    @staticmethod
    def schema() -> dict:
        return {
            "name": "subtask_list",
            "description": "Generate a new subtask list for the current task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subtasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                            },
                            "required": ["title"],
                        },
                    },
                },
                "required": ["subtasks"],
            },
        }


class SubtaskPatchTool:
    """Agent modifies existing subtasks — persists changes to DB."""

    def __init__(self, task_id: int | None = None):
        self._task_id = task_id

    async def execute(self, args: dict) -> str:
        operations = args.get("operations", [])
        if not operations:
            return "No operations provided — subtask list unchanged."

        if self._task_id is None:
            return "Error: no task_id set — cannot modify subtasks"

        import src.db as db
        session_factory = db.get_session()
        if session_factory is None:
            return "Error: database not available — subtasks not modified"

        from src.models.subtask import SubTask

        results = []
        try:
            async with session_factory() as session:
                for op in operations:
                    action = op.get("action", "")

                    if action == "add":
                        title = op.get("title", "Untitled")
                        desc = op.get("description", "")
                        position = op.get("position", 0)
                        row = SubTask(
                            task_id=self._task_id,
                            title=title,
                            description=desc,
                            status="created",
                            position=position,
                        )
                        session.add(row)
                        results.append(f"- added: {title}")

                    elif action == "remove":
                        subtask_id = op.get("id")
                        if subtask_id is not None:
                            row = await session.get(SubTask, subtask_id)
                            if row and row.task_id == self._task_id:
                                await session.delete(row)
                                results.append(f"- removed: subtask {subtask_id}")
                            else:
                                results.append(f"- remove failed: subtask {subtask_id} not found")
                        else:
                            results.append("- remove failed: no id provided")

                    elif action == "modify":
                        subtask_id = op.get("id")
                        if subtask_id is not None:
                            row = await session.get(SubTask, subtask_id)
                            if row and row.task_id == self._task_id:
                                if "title" in op:
                                    row.title = op["title"]
                                if "description" in op:
                                    row.description = op["description"]
                                if "status" in op:
                                    row.status = op["status"]
                                results.append(f"- modified: subtask {subtask_id}")
                            else:
                                results.append(f"- modify failed: subtask {subtask_id} not found")
                        else:
                            results.append("- modify failed: no id provided")

                    elif action == "reorder":
                        subtask_id = op.get("id")
                        position = op.get("position", 0)
                        if subtask_id is not None:
                            row = await session.get(SubTask, subtask_id)
                            if row and row.task_id == self._task_id:
                                row.position = position
                                results.append(f"- reordered: subtask {subtask_id} → position {position}")
                            else:
                                results.append(f"- reorder failed: subtask {subtask_id} not found")
                        else:
                            results.append("- reorder failed: no id provided")

                    else:
                        results.append(f"- unknown action: {action}")

                await session.commit()
        except Exception as exc:
            logger.error("Failed to patch subtasks for task %d: %s", self._task_id, exc)
            return f"Error patching subtasks: {exc}"

        return "Subtask modifications applied:\n" + "\n".join(results)

    @staticmethod
    def schema() -> dict:
        return {
            "name": "subtask_patch",
            "description": "Modify the current subtask list: add, remove, modify, or reorder subtasks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "action": {"type": "string", "enum": ["add", "remove", "modify", "reorder"]},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "id": {"type": "integer"},
                                "position": {"type": "integer"},
                            },
                            "required": ["action"],
                        },
                    },
                },
                "required": ["operations"],
            },
        }


class ReportResultTool:
    """Agent sends a structured report to the operator."""

    async def execute(self, args: dict) -> str:
        title = args.get("title", "Report")
        content = args.get("content", "")
        severity = args.get("severity", "info")
        return f"## {title}\n**Severity:** {severity}\n\n{content}"

    @staticmethod
    def schema() -> dict:
        return {
            "name": "report_result",
            "description": "Send a structured report or finding to the operator.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "content": {"type": "string", "description": "Report content (markdown)"},
                    "severity": {"type": "string", "enum": ["info", "low", "medium", "high", "critical"]},
                },
                "required": ["title", "content"],
            },
        }

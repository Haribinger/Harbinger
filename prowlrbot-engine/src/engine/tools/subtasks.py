"""Subtask management tools — agents can generate and modify their own subtask lists."""
import json
import logging

logger = logging.getLogger(__name__)


class SubtaskListTool:
    """Agent generates a new subtask list."""

    async def execute(self, args: dict) -> str:
        subtasks = args.get("subtasks", [])
        if not subtasks:
            return "Error: subtasks list is empty"
        formatted = []
        for i, st in enumerate(subtasks):
            title = st.get("title", f"Subtask {i}")
            desc = st.get("description", "")
            formatted.append(f"{i+1}. {title}: {desc}")
        return "Subtask plan generated:\n" + "\n".join(formatted)

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
    """Agent modifies existing subtasks (add/remove/modify/reorder)."""

    async def execute(self, args: dict) -> str:
        operations = args.get("operations", [])
        if not operations:
            return "No operations provided — subtask list unchanged."
        results = []
        for op in operations:
            action = op.get("action", "")
            results.append(f"- {action}: {op.get('title', op.get('id', '?'))}")
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

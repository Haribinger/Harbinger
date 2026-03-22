class DoneTool:
    """Barrier: agent declares task complete."""

    async def execute(self, args: dict) -> str:
        return args.get("result", "Task completed.")

    @staticmethod
    def schema() -> dict:
        return {
            "name": "done",
            "description": "Finish the current task with a success or failure report.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["success", "failure"]},
                    "result": {"type": "string", "description": "Final result summary"},
                },
                "required": ["status", "result"],
            },
        }


class AskTool:
    """Barrier: agent pauses and asks operator for input."""

    async def execute(self, args: dict) -> str:
        # The performer loop handles the actual pause/resume
        return f"WAITING: {args.get('question', 'Need input')}"

    @staticmethod
    def schema() -> dict:
        return {
            "name": "ask",
            "description": "Pause execution and ask the operator for input or approval.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["question"],
            },
        }

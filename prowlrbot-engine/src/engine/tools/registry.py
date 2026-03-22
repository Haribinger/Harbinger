from src.docker.client import DockerClient
from src.engine.tools.barriers import AskTool, DoneTool
from src.engine.tools.file_tool import FileTool
from src.engine.tools.terminal import TerminalTool

# Tool types for observability
TOOL_TYPES = {
    "terminal": "environment",
    "file": "environment",
    "done": "barrier",
    "ask": "barrier",
}

BARRIER_TOOLS = {"done", "ask"}


class ToolExecutor:
    """Registry of available tools for an agent. Executes tool calls by name."""

    def __init__(
        self,
        allowed_tools: list[str],
        container_id: str | None = None,
        docker_client: DockerClient | None = None,
    ):
        self._tools: dict[str, object] = {}
        self._schemas: dict[str, dict] = {}

        # Always available
        done = DoneTool()
        ask = AskTool()
        self._tools["done"] = done
        self._tools["ask"] = ask
        self._schemas["done"] = done.schema()
        self._schemas["ask"] = ask.schema()

        # Container-dependent tools
        if container_id and docker_client:
            if "terminal" in allowed_tools:
                t = TerminalTool(container_id, docker_client)
                self._tools["terminal"] = t
                self._schemas["terminal"] = t.schema()

            if "file" in allowed_tools:
                f = FileTool(container_id, docker_client)
                self._tools["file"] = f
                self._schemas["file"] = f.schema()

    def get_tool_definitions(self) -> list[dict]:
        """Return LLM-compatible tool definitions."""
        return [
            {"type": "function", "function": schema}
            for schema in self._schemas.values()
        ]

    async def execute(self, tool_name: str, args: dict) -> str:
        """Execute a tool by name."""
        tool = self._tools.get(tool_name)
        if not tool:
            return f"Tool '{tool_name}' not found in available tools."
        return await tool.execute(args)

    def is_barrier(self, tool_name: str) -> bool:
        return tool_name in BARRIER_TOOLS

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self._tools

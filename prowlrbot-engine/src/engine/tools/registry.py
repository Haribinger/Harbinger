from src.docker.client import DockerClient
from src.engine.tools.barriers import AskTool, DoneTool
from src.engine.tools.file_tool import FileTool
from src.engine.tools.terminal import TerminalTool
from src.engine.tools.delegation import DelegationTool, DELEGATION_SCHEMAS
from src.engine.tools.memory_tools import MemoryTool, MEMORY_TOOL_NAMES

# Tool types for observability
TOOL_TYPES = {
    "terminal": "environment",
    "file": "environment",
    "done": "barrier",
    "ask": "barrier",
    "pentester": "delegation",
    "coder": "delegation",
    "maintenance": "delegation",
    "search": "delegation",
    "memorist": "delegation",
    "advice": "delegation",
    "search_in_memory": "memory",
    "search_guide": "memory",
    "store_guide": "memory",
    "search_answer": "memory",
    "store_answer": "memory",
    "search_code": "memory",
    "store_code": "memory",
    "graphiti_search": "memory",
}

BARRIER_TOOLS = {"done", "ask"}
DELEGATION_TOOL_NAMES = set(DELEGATION_SCHEMAS.keys())


class ToolExecutor:
    """Registry of available tools for an agent. Executes tool calls by name."""

    def __init__(
        self,
        allowed_tools: list[str],
        container_id: str | None = None,
        docker_client: DockerClient | None = None,
        llm=None,
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

        # Delegation tools — only registered for agents that may delegate
        for tool_name in allowed_tools:
            if tool_name in DELEGATION_TOOL_NAMES:
                dt = DelegationTool(
                    tool_name=tool_name,
                    container_id=container_id,
                    docker_client=docker_client,
                    llm=llm,
                )
                self._tools[tool_name] = dt
                self._schemas[tool_name] = dt.schema()

        # Memory tools — semantic search and storage
        for tool_name in allowed_tools:
            if tool_name in MEMORY_TOOL_NAMES:
                mt = MemoryTool(tool_name=tool_name)
                self._tools[tool_name] = mt
                self._schemas[tool_name] = mt.schema()

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

    def is_delegation(self, tool_name: str) -> bool:
        return tool_name in DELEGATION_TOOL_NAMES

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self._tools

"""MCP Bridge — registers MCP tool providers as passive ROAR agents.

MCP tools can't speak ROAR natively. The bridge translates:
ORCHESTRATOR → ROAR message → MCP Bridge → MCP tool call → result → ROAR response
"""
import logging
import httpx
from src.config import settings

logger = logging.getLogger(__name__)

GO_BACKEND_URL = getattr(settings, "GO_BACKEND_URL", "http://localhost:8080")


class MCPBridge:
    """Translates between ROAR messages and MCP tool calls."""

    def __init__(self):
        self._endpoints: dict[str, str] = {}  # agent_id → mcp_endpoint URL

    def register(self, agent_id: str, mcp_endpoint: str):
        self._endpoints[agent_id.upper()] = mcp_endpoint
        logger.info("MCP bridge registered: %s → %s", agent_id, mcp_endpoint)

    def unregister(self, agent_id: str):
        self._endpoints.pop(agent_id.upper(), None)

    def is_mcp_agent(self, agent_id: str) -> bool:
        return agent_id.upper() in self._endpoints

    async def execute_tool(self, agent_id: str, tool_name: str, args: dict) -> str:
        """Call an MCP tool on behalf of an agent."""
        endpoint = self._endpoints.get(agent_id.upper())
        if not endpoint:
            return f"MCP bridge: no endpoint registered for {agent_id}"

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{endpoint}/tools/call",
                    json={"name": tool_name, "arguments": args},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # MCP returns content array
                    content = data.get("content", [])
                    texts = [c.get("text", "") for c in content if c.get("type") == "text"]
                    return "\n".join(texts) if texts else str(data)
                return f"MCP tool error: {resp.status_code} {resp.text[:200]}"
        except httpx.HTTPError as e:
            return f"MCP bridge error: {e}"

    async def list_tools(self, agent_id: str) -> list[dict]:
        """List available tools from an MCP server."""
        endpoint = self._endpoints.get(agent_id.upper())
        if not endpoint:
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{endpoint}/tools/list")
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("tools", []) if isinstance(data, dict) else data
        except httpx.HTTPError:
            pass
        return []

    def list_registered(self) -> list[dict]:
        return [{"agent_id": k, "mcp_endpoint": v} for k, v in self._endpoints.items()]


# Singleton
mcp_bridge = MCPBridge()

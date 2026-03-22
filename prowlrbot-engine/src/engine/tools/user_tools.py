"""User-addable tool registry — users can register custom CLI tools, scripts, and MCP servers."""
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

TOOLS_CONFIG_PATH = Path("/app/config/user_tools.json")


@dataclass
class UserTool:
    """A user-registered tool that agents can call."""
    name: str
    description: str
    command: str  # Command template with {placeholders}
    docker_image: str = "harbinger/base:latest"
    input_schema: dict = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    timeout: int = 300
    created_at: float = field(default_factory=time.time)
    created_by: str = "user"

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "command": self.command,
            "docker_image": self.docker_image,
            "input_schema": self.input_schema,
            "tags": self.tags,
            "timeout": self.timeout,
            "created_at": self.created_at,
            "created_by": self.created_by,
        }

    def to_llm_schema(self) -> dict:
        """Generate LLM-compatible tool schema."""
        properties = {}
        required = []
        for param, spec in self.input_schema.items():
            properties[param] = {
                "type": spec.get("type", "string"),
                "description": spec.get("description", param),
            }
            if "default" not in spec:
                required.append(param)

        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        }

    def render_command(self, args: dict) -> str:
        """Render command template with provided args."""
        cmd = self.command
        for key, value in args.items():
            cmd = cmd.replace(f"{{{key}}}", str(value))
        return cmd


class UserToolRegistry:
    """Registry for user-added tools. Persists to JSON file."""

    def __init__(self):
        self._tools: dict[str, UserTool] = {}

    def register(self, tool: UserTool):
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' already registered")
        self._tools[tool.name] = tool
        logger.info("Registered user tool: %s", tool.name)

    def unregister(self, name: str):
        self._tools.pop(name, None)

    def get(self, name: str) -> UserTool | None:
        return self._tools.get(name)

    def get_schema(self, name: str) -> dict | None:
        tool = self._tools.get(name)
        return tool.to_llm_schema() if tool else None

    def list_all(self) -> list[dict]:
        return [t.to_dict() for t in self._tools.values()]

    def get_all_schemas(self) -> list[dict]:
        return [t.to_llm_schema() for t in self._tools.values()]

    def save(self, path: Path | None = None):
        path = path or TOOLS_CONFIG_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        data = [t.to_dict() for t in self._tools.values()]
        path.write_text(json.dumps(data, indent=2))

    def load(self, path: Path | None = None):
        path = path or TOOLS_CONFIG_PATH
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text())
            for item in data:
                tool = UserTool(**item)
                self._tools[tool.name] = tool
            logger.info("Loaded %d user tools from %s", len(data), path)
        except Exception as e:
            logger.warning("Failed to load user tools: %s", e)


# Singleton
user_tool_registry = UserToolRegistry()

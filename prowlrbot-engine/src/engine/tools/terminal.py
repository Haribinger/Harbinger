from src.docker.client import DockerClient
from src.registry.settings import settings_registry

RESULT_SIZE_LIMIT = 16384  # 16KB


def _get_timeout(requested: int | None) -> int:
    """Resolve the effective timeout for a terminal command.

    Reads live values from settings_registry so runtime changes take effect
    without restarting the engine. Falls back to sane constants if the
    registry is somehow unavailable.
    """
    default = settings_registry.get("tools.terminal.default_timeout", 60)
    maximum = settings_registry.get("tools.terminal.max_timeout", 1200)
    if requested is None:
        return default
    return min(requested, maximum)


class TerminalTool:
    """Execute commands in an agent's Docker container."""

    def __init__(self, container_id: str, docker_client: DockerClient):
        self.container_id = container_id
        self.docker = docker_client

    async def execute(self, args: dict) -> str:
        command = args["command"]
        timeout = _get_timeout(args.get("timeout"))

        result = await self.docker.exec_command(
            self.container_id, ["sh", "-c", command], timeout=timeout
        )

        # Truncate large outputs (PentAGI pattern: keep first + last 16KB)
        if len(result) > RESULT_SIZE_LIMIT * 2:
            result = (
                result[:RESULT_SIZE_LIMIT]
                + f"\n\n[truncated {len(result) - RESULT_SIZE_LIMIT * 2} bytes]\n\n"
                + result[-RESULT_SIZE_LIMIT:]
            )

        return result

    @staticmethod
    def schema() -> dict:
        return {
            "name": "terminal",
            "description": (
                "Execute a shell command in the agent's Docker container. "
                "Blocking mode, 1200s hard timeout, 60s default timeout."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute",
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (max 1200)",
                        "default": 60,
                    },
                },
                "required": ["command"],
            },
        }

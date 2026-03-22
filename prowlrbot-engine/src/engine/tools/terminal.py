from src.docker.client import DockerClient

RESULT_SIZE_LIMIT = 16384  # 16KB
HARD_TIMEOUT = 1200  # 20 minutes
DEFAULT_TIMEOUT = 60  # 1 minute


class TerminalTool:
    """Execute commands in an agent's Docker container."""

    def __init__(self, container_id: str, docker_client: DockerClient):
        self.container_id = container_id
        self.docker = docker_client

    async def execute(self, args: dict) -> str:
        command = args["command"]
        timeout = min(args.get("timeout", DEFAULT_TIMEOUT), HARD_TIMEOUT)

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

from src.docker.client import DockerClient


class FileTool:
    """Read/write files in the agent's container workspace."""

    def __init__(self, container_id: str, docker_client: DockerClient):
        self.container_id = container_id
        self.docker = docker_client

    async def execute(self, args: dict) -> str:
        action = args["action"]
        path = args["path"]

        if action == "read":
            return await self.docker.exec_command(
                self.container_id, ["cat", path]
            )
        elif action == "write":
            content = args.get("content", "")
            escaped = content.replace("'", "'\\''")
            return await self.docker.exec_command(
                self.container_id,
                [
                    "sh",
                    "-c",
                    f"mkdir -p $(dirname '{path}') && printf '%s' '{escaped}' > '{path}' && echo 'Written to {path}'",
                ],
            )
        elif action == "append":
            content = args.get("content", "")
            escaped = content.replace("'", "'\\''")
            return await self.docker.exec_command(
                self.container_id,
                [
                    "sh",
                    "-c",
                    f"printf '%s' '{escaped}' >> '{path}' && echo 'Appended to {path}'",
                ],
            )
        elif action == "delete":
            return await self.docker.exec_command(
                self.container_id,
                ["sh", "-c", f"rm -f '{path}' && echo 'Deleted {path}'"],
            )
        else:
            return f"Unknown file action: {action}"

    @staticmethod
    def schema() -> dict:
        return {
            "name": "file",
            "description": "Read, write, append, or delete files in the agent's /work directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["read", "write", "append", "delete"],
                    },
                    "path": {
                        "type": "string",
                        "description": "File path relative to /work",
                    },
                    "content": {
                        "type": "string",
                        "description": "Content for write/append",
                    },
                },
                "required": ["action", "path"],
            },
        }

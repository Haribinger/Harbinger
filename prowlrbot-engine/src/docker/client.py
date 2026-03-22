"""
Docker Engine API client — raw HTTP, no SDK dependency.

All container lifecycle operations go through the Tecnativa socket proxy
at tcp://docker-proxy:2375 (configured via settings.docker_host).
We talk to Docker API v1.41 over plain HTTP so this works in any
environment where the Unix socket is forwarded via the proxy container.

Docker's multiplexed stream format (stdout + stderr over one connection):
    Each frame: [stream_type(1B)] [padding(3B)] [size(4B, big-endian)] [payload]
    stream_type: 1 = stdout, 2 = stderr
"""

from __future__ import annotations

import logging
import struct
from typing import Any

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

_DOCKER_API_VERSION = "v1.41"


class DockerClient:
    """
    Async HTTP client for the Docker Engine API.

    Use `async with DockerClient() as client:` or call `close()` explicitly.
    """

    def __init__(
        self,
        host: str | None = None,
        network: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        raw_host = host or settings.docker_host
        # The proxy speaks plain HTTP; Docker uses tcp:// scheme in config
        self.base_url = raw_host.replace("tcp://", "http://", 1)
        self.network = network or settings.docker_network

        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
        )

    # ------------------------------------------------------------------
    # Context manager support
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "DockerClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()

    async def close(self) -> None:
        await self._http.aclose()

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    async def ping(self) -> bool:
        """Return True if the Docker daemon is reachable."""
        try:
            resp = await self._http.get(f"/{_DOCKER_API_VERSION}/_ping")
            return resp.status_code == 200
        except Exception:
            logger.debug("Docker ping failed — daemon unreachable")
            return False

    # ------------------------------------------------------------------
    # Container config builder
    # ------------------------------------------------------------------

    def build_container_config(
        self,
        image: str,
        name: str,
        env: dict[str, str],
        workspace: str,
    ) -> dict[str, Any]:
        """
        Build a Docker container-create payload for an agent task container.

        The workspace directory is bind-mounted read-write at /work so the
        agent can read mission context and write findings without needing
        privileged access to the host.
        """
        env_list = [f"{k}={v}" for k, v in env.items()]

        return {
            "Image": image,
            "WorkingDir": "/work",
            "Env": env_list,
            # No TTY — we stream stdout/stderr through exec
            "Tty": False,
            "AttachStdout": True,
            "AttachStderr": True,
            # Keep the container alive so we can exec into it
            "Cmd": ["sleep", "infinity"],
            "HostConfig": {
                "NetworkMode": self.network,
                # workspace → /work (rw), no root escalation needed
                "Binds": [f"{workspace}:/work:rw"],
                # Never auto-remove: we inspect & collect logs after tasks finish
                "AutoRemove": False,
                # Drop all Linux capabilities — agent containers are unprivileged
                "CapDrop": ["ALL"],
                "SecurityOpt": ["no-new-privileges:true"],
            },
        }

    # ------------------------------------------------------------------
    # Container lifecycle
    # ------------------------------------------------------------------

    async def create_container(
        self, name: str, config: dict[str, Any]
    ) -> str:
        """Create a container and return its full ID."""
        resp = await self._http.post(
            f"/{_DOCKER_API_VERSION}/containers/create",
            params={"name": name},
            json=config,
        )
        resp.raise_for_status()
        return resp.json()["Id"]

    async def start_container(self, container_id: str) -> None:
        """Start a previously created container."""
        resp = await self._http.post(
            f"/{_DOCKER_API_VERSION}/containers/{container_id}/start"
        )
        resp.raise_for_status()

    async def stop_container(
        self, container_id: str, timeout: int = 10
    ) -> None:
        """
        Send SIGTERM, wait `timeout` seconds, then SIGKILL.
        Docker's `t` query param controls the grace period.
        """
        resp = await self._http.post(
            f"/{_DOCKER_API_VERSION}/containers/{container_id}/stop",
            params={"t": timeout},
        )
        # 304 = already stopped; that's fine
        if resp.status_code not in (204, 304):
            resp.raise_for_status()

    async def remove_container(
        self, container_id: str, force: bool = True
    ) -> None:
        """Remove a stopped (or running, with force=True) container."""
        resp = await self._http.delete(
            f"/{_DOCKER_API_VERSION}/containers/{container_id}",
            params={"force": force, "v": True},
        )
        # 404 = already gone; treat as success
        if resp.status_code not in (204, 404):
            resp.raise_for_status()

    # ------------------------------------------------------------------
    # Exec (run a command inside a running container)
    # ------------------------------------------------------------------

    async def exec_command(
        self,
        container_id: str,
        command: list[str],
        timeout: float = 120.0,
    ) -> str:
        """
        Run `command` inside `container_id` and return stdout as a string.

        Two-phase Docker exec:
          1. POST /exec/create  → exec ID
          2. POST /exec/{id}/start  → multiplexed stream response

        Stderr frames are discarded; only stdout is returned.  Callers that
        need stderr should use get_container_logs() after the fact.
        """
        # Phase 1: create the exec instance
        create_resp = await self._http.post(
            f"/{_DOCKER_API_VERSION}/containers/{container_id}/exec",
            json={
                "AttachStdout": True,
                "AttachStderr": True,
                "Tty": False,
                "Cmd": command,
            },
        )
        create_resp.raise_for_status()
        exec_id = create_resp.json()["Id"]

        # Phase 2: start and collect output
        # We use a generous read timeout here; security tools can be slow.
        start_resp = await self._http.post(
            f"/{_DOCKER_API_VERSION}/exec/{exec_id}/start",
            json={"Detach": False, "Tty": False},
            timeout=timeout,
        )
        start_resp.raise_for_status()

        return self._demux_docker_stream(start_resp.content)

    # ------------------------------------------------------------------
    # Logs & inspection
    # ------------------------------------------------------------------

    async def get_container_logs(
        self, container_id: str, tail: int = 200
    ) -> str:
        """
        Fetch recent log lines from a container.

        Docker returns a multiplexed stream even for logs; we demux it so
        the caller gets a clean string of stdout lines.
        """
        resp = await self._http.get(
            f"/{_DOCKER_API_VERSION}/containers/{container_id}/logs",
            params={
                "stdout": True,
                "stderr": False,
                "tail": tail,
                "timestamps": False,
            },
        )
        resp.raise_for_status()
        return self._demux_docker_stream(resp.content)

    async def inspect_container(self, container_id: str) -> dict[str, Any]:
        """Return the full container JSON from Docker's inspect endpoint."""
        resp = await self._http.get(
            f"/{_DOCKER_API_VERSION}/containers/{container_id}/json"
        )
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Stream demuxing
    # ------------------------------------------------------------------

    @staticmethod
    def _demux_docker_stream(raw: bytes) -> str:
        """
        Decode Docker's multiplexed stdout/stderr stream into a plain string.

        Frame format (8-byte header + payload):
            Byte 0    : stream type (1=stdout, 2=stderr, 0=stdin)
            Bytes 1-3 : padding / reserved (zeros)
            Bytes 4-7 : payload size, big-endian uint32

        Only stdout frames (type == 1) are included in the return value.
        If the data doesn't look like a multiplexed stream (e.g. TTY mode or
        raw log passthrough) we fall back to a straight UTF-8 decode.
        """
        if not raw:
            return ""

        # Validate that the first 8 bytes look like a Docker frame header.
        # If not, assume it's plain text (TTY=true or non-multiplexed stream).
        if len(raw) < 8:
            return raw.decode("utf-8", errors="replace")

        # Heuristic: stream_type must be 0, 1, or 2; padding bytes must be 0
        first_byte = raw[0]
        padding = raw[1:4]
        if first_byte not in (0, 1, 2) or padding != b"\x00\x00\x00":
            return raw.decode("utf-8", errors="replace")

        stdout_chunks: list[str] = []
        offset = 0

        while offset + 8 <= len(raw):
            stream_type = raw[offset]
            payload_size = struct.unpack_from(">I", raw, offset + 4)[0]
            offset += 8

            if offset + payload_size > len(raw):
                # Truncated frame — stop here rather than reading garbage
                break

            payload = raw[offset : offset + payload_size]
            offset += payload_size

            if stream_type == 1:  # stdout only
                stdout_chunks.append(payload.decode("utf-8", errors="replace"))

        return "".join(stdout_chunks)

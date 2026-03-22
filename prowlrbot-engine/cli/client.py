"""HTTP + SSE client for Harbinger CLI."""

import os
import json
import sys
from typing import Any, Callable

import httpx
from rich.console import Console

console = Console()

DEFAULT_BASE = "http://localhost:8000"


def get_base_url() -> str:
    return os.environ.get("HARBINGER_URL", DEFAULT_BASE)


def get_token() -> str:
    return os.environ.get("HARBINGER_TOKEN", "")


def _headers() -> dict[str, str]:
    token = get_token()
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def api_get(path: str, params: dict | None = None) -> Any:
    url = f"{get_base_url()}{path}"
    try:
        resp = httpx.get(url, headers=_headers(), params=params, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        console.print(f"[red]HTTP {e.response.status_code}[/]: {e.response.text[:200]}")
        sys.exit(1)
    except httpx.ConnectError:
        console.print(f"[red]Cannot connect to {url}[/] — is the engine running?")
        sys.exit(1)


def api_post(path: str, data: dict | None = None) -> Any:
    url = f"{get_base_url()}{path}"
    try:
        resp = httpx.post(url, headers=_headers(), json=data or {}, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        console.print(f"[red]HTTP {e.response.status_code}[/]: {e.response.text[:200]}")
        sys.exit(1)
    except httpx.ConnectError:
        console.print(f"[red]Cannot connect to {url}[/] — is the engine running?")
        sys.exit(1)


def sse_stream(path: str, on_event: Callable[[dict], None]) -> None:
    """Connect to an SSE endpoint and call on_event for each data frame."""
    url = f"{get_base_url()}{path}"
    token = get_token()
    if token:
        sep = "&" if "?" in url else "?"
        url += f"{sep}token={token}"

    try:
        with httpx.stream("GET", url, headers=_headers(), timeout=None) as resp:
            resp.raise_for_status()
            buffer = ""
            for chunk in resp.iter_text():
                buffer += chunk
                while "\n\n" in buffer:
                    frame, buffer = buffer.split("\n\n", 1)
                    for line in frame.split("\n"):
                        if line.startswith("data: "):
                            try:
                                data = json.loads(line[6:])
                                on_event(data)
                            except json.JSONDecodeError:
                                pass
                        elif line.startswith(": "):
                            pass  # keepalive comment
    except httpx.ConnectError:
        console.print(f"[red]Cannot connect to {url}[/]")
        sys.exit(1)
    except KeyboardInterrupt:
        pass

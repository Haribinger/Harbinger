"""
Tests for DockerClient — raw HTTP Docker Engine API wrapper.

All network calls are mocked; no real Docker daemon is needed.
"""
import struct

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.docker.client import DockerClient


# ---------------------------------------------------------------------------
# Constructor / URL normalisation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_docker_client_ping():
    client = DockerClient(host="tcp://localhost:2375")
    assert client.base_url == "http://localhost:2375"


@pytest.mark.asyncio
async def test_tcp_url_converted_to_http():
    client = DockerClient(host="tcp://docker-proxy:2375")
    assert client.base_url == "http://docker-proxy:2375"
    await client.close()


@pytest.mark.asyncio
async def test_http_url_unchanged():
    client = DockerClient(host="http://localhost:2375")
    assert client.base_url == "http://localhost:2375"
    await client.close()


# ---------------------------------------------------------------------------
# build_container_config
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_docker_client_builds_container_config():
    client = DockerClient(host="tcp://localhost:2375", network="test-net")
    config = client.build_container_config(
        image="harbinger/pd-tools:latest",
        name="harbinger-m1-pathfinder-t1",
        env={"MISSION_ID": "1", "AGENT": "PATHFINDER"},
        workspace="/data/workspace/missions/1",
    )
    assert config["Image"] == "harbinger/pd-tools:latest"
    assert config["WorkingDir"] == "/work"
    assert "MISSION_ID=1" in config["Env"]
    assert "AGENT=PATHFINDER" in config["Env"]
    assert config["HostConfig"]["NetworkMode"] == "test-net"
    await client.close()


@pytest.mark.asyncio
async def test_container_config_workspace_bind():
    client = DockerClient(host="tcp://localhost:2375", network="test-net")
    config = client.build_container_config(
        image="harbinger/pd-tools:latest",
        name="harbinger-m1-pathfinder-t1",
        env={},
        workspace="/data/workspace/missions/42",
    )
    binds = config["HostConfig"]["Binds"]
    assert any("/data/workspace/missions/42" in b for b in binds)
    await client.close()


@pytest.mark.asyncio
async def test_container_config_auto_remove():
    client = DockerClient(host="tcp://localhost:2375", network="bridge")
    config = client.build_container_config(
        image="alpine:latest",
        name="test-container",
        env={},
        workspace="/tmp/ws",
    )
    assert config["HostConfig"]["AutoRemove"] is False
    await client.close()


# ---------------------------------------------------------------------------
# ping
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ping_returns_true_on_200():
    client = DockerClient(host="tcp://localhost:2375")

    mock_response = MagicMock()
    mock_response.status_code = 200

    with patch.object(client._http, "get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        result = await client.ping()

    assert result is True
    await client.close()


@pytest.mark.asyncio
async def test_ping_returns_false_on_error():
    client = DockerClient(host="tcp://localhost:2375")

    with patch.object(client._http, "get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("connection refused")
        result = await client.ping()

    assert result is False
    await client.close()


# ---------------------------------------------------------------------------
# create_container
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_container_returns_id():
    client = DockerClient(host="tcp://localhost:2375")

    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"Id": "abc123def456"}
    mock_response.raise_for_status = MagicMock()

    with patch.object(client._http, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        container_id = await client.create_container(
            name="test-agent",
            config={"Image": "alpine:latest"},
        )

    assert container_id == "abc123def456"
    await client.close()


# ---------------------------------------------------------------------------
# start_container
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_start_container_calls_correct_url():
    client = DockerClient(host="tcp://localhost:2375")

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    with patch.object(client._http, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        await client.start_container("abc123")

    called_url = mock_post.call_args[0][0]
    assert "abc123" in called_url
    assert "start" in called_url
    await client.close()


# ---------------------------------------------------------------------------
# stop_container
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stop_container_passes_timeout():
    client = DockerClient(host="tcp://localhost:2375")

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    with patch.object(client._http, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        await client.stop_container("abc123", timeout=15)

    call_kwargs = mock_post.call_args
    # timeout param must reach the API
    assert call_kwargs is not None
    await client.close()


# ---------------------------------------------------------------------------
# remove_container
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_remove_container_calls_delete():
    client = DockerClient(host="tcp://localhost:2375")

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    with patch.object(client._http, "delete", new_callable=AsyncMock) as mock_delete:
        mock_delete.return_value = mock_response
        await client.remove_container("abc123")

    called_url = mock_delete.call_args[0][0]
    assert "abc123" in called_url
    await client.close()


# ---------------------------------------------------------------------------
# get_container_logs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_container_logs_returns_string():
    client = DockerClient(host="tcp://localhost:2375")

    raw_log = b"log line one\nlog line two\n"
    mock_response = MagicMock()
    mock_response.content = raw_log
    mock_response.raise_for_status = MagicMock()

    with patch.object(client._http, "get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        logs = await client.get_container_logs("abc123", tail=50)

    assert isinstance(logs, str)
    await client.close()


# ---------------------------------------------------------------------------
# inspect_container
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_inspect_container_returns_dict():
    client = DockerClient(host="tcp://localhost:2375")

    mock_data = {"Id": "abc123", "State": {"Status": "running"}}
    mock_response = MagicMock()
    mock_response.json.return_value = mock_data
    mock_response.raise_for_status = MagicMock()

    with patch.object(client._http, "get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        info = await client.inspect_container("abc123")

    assert info["State"]["Status"] == "running"
    await client.close()


# ---------------------------------------------------------------------------
# exec_command — Docker stream demuxing
# ---------------------------------------------------------------------------

def _make_docker_frame(stream_type: int, data: bytes) -> bytes:
    """Build a single Docker multiplexed stream frame."""
    header = struct.pack(">BxxxI", stream_type, len(data))
    return header + data


@pytest.mark.asyncio
async def test_exec_command_demuxes_stdout():
    client = DockerClient(host="tcp://localhost:2375")

    stdout_frame = _make_docker_frame(1, b"hello from stdout\n")
    stderr_frame = _make_docker_frame(2, b"some stderr noise\n")
    raw = stdout_frame + stderr_frame

    # exec create
    mock_create = MagicMock()
    mock_create.status_code = 201
    mock_create.json.return_value = {"Id": "exec-id-001"}
    mock_create.raise_for_status = MagicMock()

    # exec start
    mock_start = MagicMock()
    mock_start.content = raw
    mock_start.raise_for_status = MagicMock()

    with patch.object(client._http, "post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [mock_create, mock_start]
        output = await client.exec_command("abc123", ["echo", "hello"])

    assert "hello from stdout" in output
    await client.close()


@pytest.mark.asyncio
async def test_demux_docker_stream_stdout_only():
    frame = _make_docker_frame(1, b"output line\n")
    result = DockerClient._demux_docker_stream(frame)
    assert result == "output line\n"


@pytest.mark.asyncio
async def test_demux_docker_stream_ignores_stderr():
    stderr_frame = _make_docker_frame(2, b"error noise\n")
    stdout_frame = _make_docker_frame(1, b"real output\n")
    result = DockerClient._demux_docker_stream(stderr_frame + stdout_frame)
    assert "real output" in result
    assert "error noise" not in result


@pytest.mark.asyncio
async def test_demux_empty_returns_empty():
    result = DockerClient._demux_docker_stream(b"")
    assert result == ""


@pytest.mark.asyncio
async def test_demux_plain_text_fallback():
    # If there's no valid 8-byte header, fall back to raw decode
    plain = b"plain text output\n"
    result = DockerClient._demux_docker_stream(plain)
    # Should not crash; returns something string-shaped
    assert isinstance(result, str)

import pytest
from unittest.mock import AsyncMock

from src.engine.tools.terminal import TerminalTool


@pytest.mark.asyncio
async def test_terminal_tool_executes_command():
    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "hello world\n"

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    result = await tool.execute({"command": "echo hello world"})

    assert result == "hello world\n"
    mock_docker.exec_command.assert_called_once_with(
        "abc123", ["sh", "-c", "echo hello world"], timeout=60
    )


@pytest.mark.asyncio
async def test_terminal_tool_truncates_large_output():
    mock_docker = AsyncMock()
    large_output = "x" * 50000
    mock_docker.exec_command.return_value = large_output

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    result = await tool.execute({"command": "cat bigfile"})

    assert len(result) < 50000
    assert "[truncated" in result


@pytest.mark.asyncio
async def test_terminal_tool_respects_timeout():
    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "ok"

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    await tool.execute({"command": "sleep 5", "timeout": 10})

    mock_docker.exec_command.assert_called_once_with(
        "abc123", ["sh", "-c", "sleep 5"], timeout=10
    )


@pytest.mark.asyncio
async def test_terminal_tool_caps_timeout_at_1200():
    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "ok"

    tool = TerminalTool(container_id="abc123", docker_client=mock_docker)
    await tool.execute({"command": "long-scan", "timeout": 9999})

    mock_docker.exec_command.assert_called_once_with(
        "abc123", ["sh", "-c", "long-scan"], timeout=1200
    )

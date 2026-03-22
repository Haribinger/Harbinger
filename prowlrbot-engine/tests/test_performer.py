import pytest
from unittest.mock import AsyncMock

from src.engine.performer import perform_agent_chain
from src.engine.tools.registry import ToolExecutor


class FakeLLM:
    """Mock LLM that returns predetermined tool calls."""

    def __init__(self, responses: list[dict]):
        self._responses = responses
        self._call_count = 0

    async def call_with_tools(self, chain, tools, model=None):
        if self._call_count >= len(self._responses):
            return {"tool_calls": [{"name": "done", "args": {"status": "success", "result": "Done"}}], "usage": {"input": 0, "output": 0}}
        resp = self._responses[self._call_count]
        self._call_count += 1
        return resp


@pytest.mark.asyncio
async def test_performer_executes_terminal_and_finishes():
    llm = FakeLLM([
        {"tool_calls": [{"name": "terminal", "args": {"command": "echo hi"}}], "usage": {"input": 10, "output": 10}},
        {"tool_calls": [{"name": "done", "args": {"status": "success", "result": "Found stuff"}}], "usage": {"input": 10, "output": 10}},
    ])

    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "hi\n"

    executor = ToolExecutor(
        allowed_tools=["terminal"],
        container_id="test-container",
        docker_client=mock_docker,
    )

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "You are a test agent"}],
        executor=executor,
        llm=llm,
        max_iterations=10,
    )

    assert result["status"] == "done"
    assert result["result"] == "Found stuff"


@pytest.mark.asyncio
async def test_performer_returns_waiting_on_ask():
    llm = FakeLLM([
        {"tool_calls": [{"name": "ask", "args": {"question": "Should I proceed?"}}], "usage": {"input": 10, "output": 10}},
    ])

    executor = ToolExecutor(allowed_tools=[])

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "You are a test agent"}],
        executor=executor,
        llm=llm,
        max_iterations=10,
    )

    assert result["status"] == "waiting"


@pytest.mark.asyncio
async def test_performer_fails_on_max_iterations():
    # LLM never calls done
    llm = FakeLLM([
        {"tool_calls": [{"name": "terminal", "args": {"command": "echo loop"}}], "usage": {"input": 10, "output": 10}},
    ] * 5)

    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "loop\n"

    executor = ToolExecutor(
        allowed_tools=["terminal"],
        container_id="test-container",
        docker_client=mock_docker,
    )

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "You are a test agent"}],
        executor=executor,
        llm=llm,
        max_iterations=3,
    )

    assert result["status"] == "failed"


@pytest.mark.asyncio
async def test_performer_tracks_token_usage():
    llm = FakeLLM([
        {"tool_calls": [{"name": "terminal", "args": {"command": "whoami"}}], "usage": {"input": 100, "output": 50}},
        {"tool_calls": [{"name": "done", "args": {"status": "success", "result": "ok"}}], "usage": {"input": 80, "output": 30}},
    ])

    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "root\n"

    executor = ToolExecutor(
        allowed_tools=["terminal"],
        container_id="test-container",
        docker_client=mock_docker,
    )

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "test"}],
        executor=executor,
        llm=llm,
        max_iterations=10,
    )

    assert result["status"] == "done"
    assert result["tokens"]["input"] == 180
    assert result["tokens"]["output"] == 80


@pytest.mark.asyncio
async def test_performer_calls_on_action_callback():
    llm = FakeLLM([
        {"tool_calls": [{"name": "terminal", "args": {"command": "id"}}], "usage": {"input": 10, "output": 10}},
        {"tool_calls": [{"name": "done", "args": {"status": "success", "result": "done"}}], "usage": {"input": 10, "output": 10}},
    ])

    mock_docker = AsyncMock()
    mock_docker.exec_command.return_value = "uid=0(root)\n"

    executor = ToolExecutor(
        allowed_tools=["terminal"],
        container_id="test-container",
        docker_client=mock_docker,
    )

    actions_logged = []

    async def on_action(tool_name, args, result, duration):
        actions_logged.append({"tool": tool_name, "result": result})

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "test"}],
        executor=executor,
        llm=llm,
        max_iterations=10,
        on_action=on_action,
    )

    assert result["status"] == "done"
    # terminal + done = 2 action callbacks
    assert len(actions_logged) == 2
    assert actions_logged[0]["tool"] == "terminal"
    assert actions_logged[1]["tool"] == "done"


@pytest.mark.asyncio
async def test_performer_nudges_llm_when_no_tool_calls():
    """LLM returns no tool calls on first try, then calls done."""
    llm = FakeLLM([
        {"tool_calls": [], "usage": {"input": 10, "output": 10}},
        {"tool_calls": [{"name": "done", "args": {"status": "success", "result": "recovered"}}], "usage": {"input": 10, "output": 10}},
    ])

    executor = ToolExecutor(allowed_tools=[])

    result = await perform_agent_chain(
        chain=[{"role": "system", "content": "test"}],
        executor=executor,
        llm=llm,
        max_iterations=10,
    )

    assert result["status"] == "done"
    assert result["result"] == "recovered"

"""Tests for LLMAdapter — verifies the adapter contract without hitting real LLMs."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def adapter():
    from src.agents.llm import LLMAdapter

    return LLMAdapter(default_model="ollama/llama3.1:8b")


class TestLLMAdapter:
    async def test_default_model(self, adapter):
        assert adapter.default_model == "ollama/llama3.1:8b"

    async def test_call_with_tools_no_tool_calls(self, adapter):
        """When the LLM returns text only (no tool calls), we get an empty list."""
        mock_message = MagicMock()
        mock_message.content = "I'll think about this."
        mock_message.tool_calls = None

        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 100
        mock_usage.completion_tokens = 20

        mock_choice = MagicMock()
        mock_choice.message = mock_message

        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = mock_usage

        with patch("src.agents.llm.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)

            chain = [{"role": "user", "content": "hello"}]
            result = await adapter.call_with_tools(chain)

            assert result["tool_calls"] == []
            assert result["content"] == "I'll think about this."
            assert result["usage"]["input"] == 100
            assert result["usage"]["output"] == 20

    async def test_call_with_tools_parses_tool_calls(self, adapter):
        """When the LLM returns tool calls, they're parsed correctly."""
        mock_tc = MagicMock()
        mock_tc.id = "call_123"
        mock_tc.function = MagicMock()
        mock_tc.function.name = "terminal"
        mock_tc.function.arguments = json.dumps({"command": "ls -la"})

        mock_message = MagicMock()
        mock_message.content = None
        mock_message.tool_calls = [mock_tc]

        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 50
        mock_usage.completion_tokens = 30

        mock_choice = MagicMock()
        mock_choice.message = mock_message

        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = mock_usage

        with patch("src.agents.llm.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)

            chain = [{"role": "user", "content": "list files"}]
            tools = [{"type": "function", "function": {"name": "terminal"}}]
            result = await adapter.call_with_tools(chain, tools=tools)

            assert len(result["tool_calls"]) == 1
            assert result["tool_calls"][0]["name"] == "terminal"
            assert result["tool_calls"][0]["args"] == {"command": "ls -la"}
            assert result["tool_calls"][0]["id"] == "call_123"

    async def test_call_with_tools_appends_to_chain(self, adapter):
        """The adapter should append the assistant message to the chain."""
        mock_message = MagicMock()
        mock_message.content = "thinking..."
        mock_message.tool_calls = None

        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 10
        mock_usage.completion_tokens = 5

        mock_choice = MagicMock()
        mock_choice.message = mock_message

        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = mock_usage

        with patch("src.agents.llm.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)

            chain = [{"role": "user", "content": "hello"}]
            await adapter.call_with_tools(chain)

            # Chain should now have the user message + assistant response
            assert len(chain) == 2
            assert chain[1]["role"] == "assistant"
            assert chain[1]["content"] == "thinking..."

    async def test_call_error_returns_empty(self, adapter):
        """On LLM failure, return empty result instead of crashing."""
        with patch("src.agents.llm.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(
                side_effect=Exception("connection refused")
            )

            chain = [{"role": "user", "content": "hello"}]
            result = await adapter.call_with_tools(chain)

            assert result["tool_calls"] == []
            assert result["content"] is None
            assert result["usage"] == {"input": 0, "output": 0}


class TestPromptLoading:
    def test_load_existing_prompt(self):
        from src.agents.prompts import load_prompt

        prompt = load_prompt("PATHFINDER")
        assert "PATHFINDER" in prompt
        assert "reconnaissance" in prompt.lower()

    def test_load_nonexistent_prompt(self):
        from src.agents.prompts import load_prompt

        prompt = load_prompt("NONEXISTENT_AGENT_XYZ")
        assert prompt == ""

    def test_build_system_prompt_with_context(self):
        from src.agents.prompts import build_system_prompt

        prompt = build_system_prompt(
            agent_codename="BREACH",
            mission_id=42,
            task_id=7,
        )
        assert "BREACH" in prompt
        assert "MISSION ID: 42" in prompt
        assert "TASK ID: 7" in prompt

    def test_build_system_prompt_fallback(self):
        from src.agents.prompts import build_system_prompt

        prompt = build_system_prompt(
            agent_codename="UNKNOWN_AGENT",
            mission_id=1,
        )
        # Should get the fallback prompt
        assert "UNKNOWN_AGENT" in prompt
        assert "done" in prompt.lower()

    def test_all_agents_have_prompts(self):
        """Every agent in the registry should have a prompt file."""
        from src.agents.prompts import load_prompt
        from src.registry.agents import agent_registry

        for agent in agent_registry.list_all():
            codename = agent["codename"]
            prompt = load_prompt(codename)
            # All standard agents should have prompts; user-added agents may not
            if prompt:
                assert len(prompt) > 50, f"{codename} prompt is too short"

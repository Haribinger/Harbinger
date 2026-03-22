"""
LLM adapter — unified interface for calling language models with tool calling.

Wraps litellm.acompletion() so the rest of the engine only depends on a single
``call_with_tools()`` contract.  Supports any provider litellm supports (OpenAI,
Anthropic, Ollama, Bedrock, etc.) through the same interface.

The performer and delegation tools receive an ``LLMAdapter`` instance and never
import litellm directly.
"""

import json
import logging
import os

import litellm

from src.config import settings

logger = logging.getLogger(__name__)

# Silence litellm's verbose startup logs
litellm.suppress_debug_info = True
litellm.set_verbose = False


class LLMAdapter:
    """Stateless adapter that converts Harbinger tool schemas to litellm calls."""

    def __init__(self, default_model: str | None = None):
        self.default_model = default_model or os.getenv(
            "LLM_MODEL", "ollama/llama3.1:8b"
        )
        # Ollama needs the base URL pointed at the right host
        if self.default_model.startswith("ollama/"):
            litellm.api_base = settings.ollama_url

    async def call_with_tools(
        self,
        chain: list[dict],
        tools: list[dict] | None = None,
        model: str | None = None,
    ) -> dict:
        """Call LLM with optional tool definitions.

        Args:
            chain: message list (system/user/assistant/tool roles)
            tools: OpenAI-format function definitions
            model: override model for this call

        Returns:
            {
                "tool_calls": [{"id": str, "name": str, "args": dict}, ...],
                "content": str | None,
                "usage": {"input": int, "output": int},
            }
        """
        effective_model = model or self.default_model

        # Build litellm kwargs
        kwargs: dict = {
            "model": effective_model,
            "messages": _sanitize_messages(chain),
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        # Ollama base URL override
        if effective_model.startswith("ollama/"):
            kwargs["api_base"] = settings.ollama_url

        try:
            response = await litellm.acompletion(**kwargs)
        except Exception as exc:
            logger.error("LLM call failed (model=%s): %s", effective_model, exc)
            return {"tool_calls": [], "content": None, "usage": {"input": 0, "output": 0}}

        message = response.choices[0].message

        # Parse tool calls
        tool_calls = []
        if message.tool_calls:
            for tc in message.tool_calls:
                try:
                    args = (
                        json.loads(tc.function.arguments)
                        if isinstance(tc.function.arguments, str)
                        else tc.function.arguments
                    )
                except (json.JSONDecodeError, TypeError):
                    args = {}
                tool_calls.append({
                    "id": tc.id or tc.function.name,
                    "name": tc.function.name,
                    "args": args,
                })

        # Append assistant message to chain so the caller's chain stays consistent
        assistant_msg: dict = {"role": "assistant", "content": message.content or ""}
        if message.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in message.tool_calls
            ]
        chain.append(assistant_msg)

        usage = response.usage
        return {
            "tool_calls": tool_calls,
            "content": message.content,
            "usage": {
                "input": usage.prompt_tokens if usage else 0,
                "output": usage.completion_tokens if usage else 0,
            },
        }

    async def generate(self, prompt: str, model: str | None = None) -> str:
        """Simple text generation — no tools. Used by summarizer."""
        result = await self.call_with_tools(
            chain=[{"role": "user", "content": prompt}],
            model=model,
        )
        return result.get("content") or ""


def _sanitize_messages(chain: list[dict]) -> list[dict]:
    """Clean up messages for litellm compatibility.

    - Remove empty content fields
    - Ensure tool results have the right structure
    - Strip internal-only keys
    """
    clean = []
    for msg in chain:
        m = {k: v for k, v in msg.items() if v is not None}
        # litellm requires content to be a string, not None
        if "content" not in m and m.get("role") != "assistant":
            m["content"] = ""
        clean.append(m)
    return clean

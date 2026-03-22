"""Agent prompt loading — builds system prompts for each specialist."""

import os
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent

# Cache loaded prompts so we only read from disk once
_cache: dict[str, str] = {}


def load_prompt(agent_codename: str) -> str:
    """Load a specialist prompt by codename. Returns empty string if not found."""
    key = agent_codename.upper()
    if key in _cache:
        return _cache[key]

    filename = f"{key.lower()}.md"
    path = PROMPTS_DIR / filename
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8")
    _cache[key] = text
    return text


def build_system_prompt(
    agent_codename: str,
    mission_id: int | None = None,
    task_id: int | None = None,
    task_input: str = "",
    execution_context: str = "",
) -> str:
    """Build the full system prompt for an agent execution.

    Combines:
      1. Agent specialist prompt (personality + instructions)
      2. Execution context (mission/task IDs, target, scope)
      3. Task-specific instructions
    """
    prompt = load_prompt(agent_codename)
    if not prompt:
        # Fallback for agents without a dedicated prompt file
        prompt = (
            f"You are {agent_codename}, a Harbinger security agent.\n"
            "Execute the assigned task using the available tools.\n"
            "Report results using the 'done' tool when finished.\n"
            "If you need operator input, use the 'ask' tool."
        )

    parts = [prompt]

    if execution_context:
        parts.append(f"\n<execution_context>\n{execution_context}\n</execution_context>")
    elif mission_id is not None:
        ctx = f"MISSION ID: {mission_id}"
        if task_id is not None:
            ctx += f"\nTASK ID: {task_id}"
        parts.append(f"\n<execution_context>\n{ctx}\n</execution_context>")

    return "\n".join(parts)

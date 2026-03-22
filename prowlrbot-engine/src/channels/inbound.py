"""Inbound channel message router — matches incoming messages to pending barriers."""

import logging
import re

from src.engine.ask_barrier import ask_barrier

logger = logging.getLogger(__name__)

# Pattern: /respond <subtask_id> <response text>
RESPOND_PATTERN = re.compile(r"^/respond\s+(\S+)\s+(.+)$", re.DOTALL)


async def route_inbound_message(
    channel_name: str,
    sender_id: str,
    text: str,
    metadata: dict | None = None,
) -> dict:
    """Route an inbound channel message to the appropriate barrier.

    Checks if the message matches the /respond pattern or a button callback.
    Returns {"matched": bool, "subtask_id": str|None, "response": str|None}.
    """
    # Check for /respond command
    match = RESPOND_PATTERN.match(text.strip())
    if match:
        subtask_id = match.group(1)
        response = match.group(2).strip()
        success = ask_barrier.respond(subtask_id, response)
        if success:
            logger.info(
                "Barrier responded via %s: subtask=%s sender=%s",
                channel_name,
                subtask_id,
                sender_id,
            )
            return {"matched": True, "subtask_id": subtask_id, "response": response}
        else:
            logger.warning(
                "Barrier not found for response via %s: subtask=%s",
                channel_name,
                subtask_id,
            )
            return {"matched": False, "subtask_id": subtask_id, "response": None}

    # Check for button callback data (Telegram/Slack)
    callback_data = (metadata or {}).get("callback_data", "")
    if callback_data.startswith("barrier:"):
        parts = callback_data.split(":", 2)
        if len(parts) == 3:
            subtask_id = parts[1]
            response = parts[2]
            success = ask_barrier.respond(subtask_id, response)
            return {"matched": success, "subtask_id": subtask_id, "response": response}

    return {"matched": False, "subtask_id": None, "response": None}

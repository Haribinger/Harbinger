"""Tests for channel notification bridge."""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from src.channels.notify import (
    format_barrier_message,
    format_discord_embed,
    format_slack_blocks,
    format_telegram_message,
)
from src.channels.inbound import route_inbound_message
from src.engine.ask_barrier import AskUserBarrier, PendingBarrier


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_barrier(
    subtask_id: str = "sub-123",
    agent_codename: str = "BREACH",
    question: str = "Proceed with exploit?",
    options: list[str] | None = None,
    mission_id: str = "mission-42",
) -> PendingBarrier:
    """Create a PendingBarrier instance without needing a running event loop."""
    return PendingBarrier(
        subtask_id=subtask_id,
        agent_codename=agent_codename,
        question=question,
        options=options or [],
        mission_id=mission_id,
    )


# ---------------------------------------------------------------------------
# 1. format_barrier_message
# ---------------------------------------------------------------------------

def test_format_barrier_message_contains_question():
    barrier = _make_barrier(question="Is target in scope?", options=["yes", "no"])
    msg = format_barrier_message(barrier)

    assert "Is target in scope?" in msg["text"]
    assert "BREACH" in msg["text"]
    assert "sub-123" in msg["text"]
    assert "/respond sub-123" in msg["text"]


def test_format_barrier_message_lists_options():
    barrier = _make_barrier(options=["approve", "deny", "escalate"])
    msg = format_barrier_message(barrier)

    assert "approve" in msg["text"]
    assert "deny" in msg["text"]
    assert "escalate" in msg["text"]


def test_format_barrier_message_no_options():
    barrier = _make_barrier(options=[])
    msg = format_barrier_message(barrier)
    # Options section should be absent when there are no options
    assert "Options" not in msg["text"]


def test_format_barrier_message_payload_structure():
    barrier = _make_barrier(options=["yes"])
    msg = format_barrier_message(barrier)

    payload = msg["payload"]
    assert payload["type"] == "barrier_ask"
    assert payload["subtask_id"] == "sub-123"
    assert payload["agent_codename"] == "BREACH"
    assert "discord" in payload
    assert "telegram" in payload
    assert "slack" in payload


# ---------------------------------------------------------------------------
# 2. format_discord_embed
# ---------------------------------------------------------------------------

def test_format_discord_embed_structure():
    barrier = _make_barrier(options=["yes", "no"])
    embed_payload = format_discord_embed(barrier)

    assert "embeds" in embed_payload
    embed = embed_payload["embeds"][0]
    assert embed["color"] == 15782720  # Harbinger gold #F0C040
    assert embed["title"] == "🔔 Operator Input Needed"
    # Agent and Mission inline fields
    field_names = [f["name"] for f in embed["fields"]]
    assert "Agent" in field_names
    assert "Mission" in field_names
    assert "Question" in field_names
    assert "Options" in field_names
    # Footer contains subtask ID
    assert "sub-123" in embed["footer"]["text"]


def test_format_discord_embed_no_options():
    barrier = _make_barrier(options=[])
    embed_payload = format_discord_embed(barrier)
    field_names = [f["name"] for f in embed_payload["embeds"][0]["fields"]]
    assert "Options" not in field_names


# ---------------------------------------------------------------------------
# 3. format_telegram_message
# ---------------------------------------------------------------------------

def test_format_telegram_message_with_options():
    barrier = _make_barrier(options=["proceed", "abort"])
    msg = format_telegram_message(barrier)

    assert msg["parse_mode"] == "Markdown"
    assert "BREACH" in msg["text"]
    assert "reply_markup" in msg
    keyboard = msg["reply_markup"]["inline_keyboard"]
    # Each option becomes its own row
    assert len(keyboard) == 2
    # Callback data encodes subtask_id and option
    assert keyboard[0][0]["callback_data"] == "barrier:sub-123:proceed"
    assert keyboard[1][0]["callback_data"] == "barrier:sub-123:abort"


def test_format_telegram_message_no_options():
    barrier = _make_barrier(options=[])
    msg = format_telegram_message(barrier)
    assert "reply_markup" not in msg


# ---------------------------------------------------------------------------
# 4. format_slack_blocks
# ---------------------------------------------------------------------------

def test_format_slack_blocks_structure():
    barrier = _make_barrier(options=["yes", "no"])
    result = format_slack_blocks(barrier)

    blocks = result["blocks"]
    # Header block
    assert blocks[0]["type"] == "header"
    assert "Operator Input Needed" in blocks[0]["text"]["text"]
    # Agent/Mission section
    assert blocks[1]["type"] == "section"
    # Question section
    assert blocks[2]["type"] == "section"
    assert "Proceed with exploit?" in blocks[2]["text"]["text"]
    # Actions block with buttons
    actions = blocks[3]
    assert actions["type"] == "actions"
    assert len(actions["elements"]) == 2
    # Button values match options
    values = [el["value"] for el in actions["elements"]]
    assert "yes" in values
    assert "no" in values


def test_format_slack_blocks_no_options():
    barrier = _make_barrier(options=[])
    result = format_slack_blocks(barrier)
    # No actions block when there are no options
    block_types = [b["type"] for b in result["blocks"]]
    assert "actions" not in block_types


# ---------------------------------------------------------------------------
# 5. route_inbound_message — /respond command
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_route_respond_command_resolves_barrier():
    """A valid /respond command finds the barrier and resolves it."""
    local_barrier = AskUserBarrier()
    # Plant a pending barrier (without actually awaiting ask())
    pending = PendingBarrier(
        subtask_id="sub-123",
        agent_codename="BREACH",
        question="Proceed?",
        options=[],
        mission_id="m-1",

    )
    local_barrier._pending["sub-123"] = pending

    with patch("src.channels.inbound.ask_barrier", local_barrier):
        result = await route_inbound_message(
            channel_name="discord",
            sender_id="operator-1",
            text="/respond sub-123 yes",
        )

    assert result["matched"] is True
    assert result["subtask_id"] == "sub-123"
    assert result["response"] == "yes"
    # Event is set and response is stored on the barrier
    assert pending.event.is_set()
    assert pending.response == "yes"


@pytest.mark.asyncio
async def test_route_respond_command_unknown_barrier():
    """A /respond for a non-existent barrier returns matched=False."""
    local_barrier = AskUserBarrier()  # empty — no pending barriers

    with patch("src.channels.inbound.ask_barrier", local_barrier):
        result = await route_inbound_message(
            channel_name="telegram",
            sender_id="op-99",
            text="/respond sub-999 approve",
        )

    assert result["matched"] is False
    assert result["subtask_id"] == "sub-999"
    assert result["response"] is None


# ---------------------------------------------------------------------------
# 6. route_inbound_message — callback_data
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_route_callback_data_resolves_barrier():
    """A Telegram/Slack button callback resolves the barrier."""
    local_barrier = AskUserBarrier()
    pending = PendingBarrier(
        subtask_id="sub-456",
        agent_codename="PATHFINDER",
        question="Scan aggressively?",
        options=["yes", "no"],
        mission_id="m-2",

    )
    local_barrier._pending["sub-456"] = pending

    with patch("src.channels.inbound.ask_barrier", local_barrier):
        result = await route_inbound_message(
            channel_name="telegram",
            sender_id="op-2",
            text="",  # button presses have no text
            metadata={"callback_data": "barrier:sub-456:approve"},
        )

    assert result["matched"] is True
    assert result["subtask_id"] == "sub-456"
    assert result["response"] == "approve"


# ---------------------------------------------------------------------------
# 7. route_inbound_message — no match
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_route_no_match_regular_message():
    """An ordinary chat message that doesn't match any pattern."""
    result = await route_inbound_message(
        channel_name="slack",
        sender_id="op-3",
        text="Hey, what's the status?",
    )

    assert result["matched"] is False
    assert result["subtask_id"] is None
    assert result["response"] is None


@pytest.mark.asyncio
async def test_route_no_match_partial_respond():
    """A message that starts with /respond but is missing the response."""
    result = await route_inbound_message(
        channel_name="discord",
        sender_id="op-4",
        text="/respond sub-123",  # missing response text
    )

    assert result["matched"] is False


# ---------------------------------------------------------------------------
# 8. FastAPI endpoint — POST /api/v2/channels/inbound
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_inbound_api_matched(app):
    """Posting a /respond command resolves a pending barrier and returns ok."""
    local_barrier = AskUserBarrier()
    pending = PendingBarrier(
        subtask_id="sub-789",
        agent_codename="CIPHER",
        question="Continue RE?",
        options=["yes", "no"],
        mission_id="m-3",
    )
    local_barrier._pending["sub-789"] = pending

    with patch("src.channels.inbound.ask_barrier", local_barrier):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v2/channels/inbound",
                json={
                    "channel": "discord",
                    "sender_id": "op-10",
                    "text": "/respond sub-789 continue",
                },
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["matched"] is True
    assert data["subtask_id"] == "sub-789"
    assert data["response"] == "continue"


@pytest.mark.asyncio
async def test_inbound_api_no_match(app):
    """Posting a regular message returns ok=True with matched=False."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v2/channels/inbound",
            json={
                "channel": "slack",
                "sender_id": "op-11",
                "text": "just a regular message",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["matched"] is False

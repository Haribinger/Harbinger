"""Tests for the War Room SSE stream module."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.warroom.bus import AgentBus, BusEvent
from src.warroom.stream import _format_sse, sse_event_generator


# ── SSE formatting ───────────────────────────────────────────────────────────

def test_format_sse_basic():
    event = BusEvent(
        id="e1", type="test", source="BREACH", target="broadcast",
        channel="mission:1", payload={"key": "value"}, timestamp=1234567890.0,
    )
    result = _format_sse(event)
    assert result.startswith("id: e1\n")
    assert "data: " in result
    assert result.endswith("\n\n")
    assert '"key": "value"' in result


def test_format_sse_replay():
    event = BusEvent(
        id="e2", type="test", source="a", target="b",
        channel="c", timestamp=1.0,
    )
    result = _format_sse(event, replay=True)
    assert '"_replay": true' in result


def test_format_sse_no_replay_flag():
    event = BusEvent(
        id="e3", type="test", source="a", target="b",
        channel="c", timestamp=1.0,
    )
    result = _format_sse(event, replay=False)
    assert "_replay" not in result


# ── SSE generator ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sse_generator_replays_recent():
    """Generator should replay recent events from ring buffer first."""
    bus = AgentBus(ring_size=50)

    # Pre-populate ring buffer
    for i in range(3):
        await bus.publish(BusEvent(
            id=f"replay_{i}", type="test", source="a", target="b",
            channel="mission:1", timestamp=float(i),
        ))

    # Mock request that disconnects after replay
    mock_request = MagicMock()
    call_count = 0
    async def is_disconnected():
        nonlocal call_count
        call_count += 1
        return call_count > 4  # Disconnect after replay + first live check
    mock_request.is_disconnected = is_disconnected

    frames = []
    async for frame in sse_event_generator(bus, "mission:1", mock_request, replay_limit=10):
        frames.append(frame)
        if len(frames) >= 3:
            break

    assert len(frames) == 3
    assert '"_replay": true' in frames[0]
    assert "replay_0" in frames[0]


@pytest.mark.asyncio
async def test_sse_generator_live_events():
    """Generator should deliver live events after replay."""
    bus = AgentBus()

    mock_request = MagicMock()
    disconnect_after = 2
    call_count = 0
    async def is_disconnected():
        nonlocal call_count
        call_count += 1
        return call_count > disconnect_after
    mock_request.is_disconnected = is_disconnected

    # Start generator and publish a live event
    async def publish_delayed():
        await asyncio.sleep(0.05)
        await bus.publish(BusEvent(
            id="live_1", type="test", source="PATHFINDER", target="broadcast",
            channel="mission:1", timestamp=999.0,
        ))

    asyncio.create_task(publish_delayed())

    frames = []
    async for frame in sse_event_generator(bus, "mission:1", mock_request, replay_limit=0):
        frames.append(frame)
        if "live_1" in frame:
            break

    assert any("live_1" in f for f in frames)


@pytest.mark.asyncio
async def test_sse_generator_cleanup():
    """Generator should unsubscribe when client disconnects."""
    bus = AgentBus()

    mock_request = MagicMock()
    async def always_disconnected():
        return True
    mock_request.is_disconnected = always_disconnected

    # Consume the generator — should exit immediately
    frames = []
    async for frame in sse_event_generator(bus, "mission:1", mock_request):
        frames.append(frame)

    # Should have no subscribers after cleanup
    assert bus.subscriber_count == 0

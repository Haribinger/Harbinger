"""
War Room SSE stream — real-time event delivery to connected clients.

Clients open an SSE connection to /api/v2/warroom/{mission_id}/stream and
receive all events for that mission as they happen. Supports channel filtering
and replays recent events for late-joining clients.
"""

import asyncio
import json
import logging

from starlette.requests import Request
from starlette.responses import StreamingResponse

from src.warroom.bus import AgentBus, BusEvent, _gen_id

logger = logging.getLogger(__name__)


async def sse_event_generator(
    bus: AgentBus,
    channel: str,
    request: Request,
    replay_limit: int = 50,
):
    """
    Async generator that yields SSE-formatted events.

    1. Replays recent events from the ring buffer (catch-up)
    2. Subscribes to live events and yields them as they arrive
    3. Cleans up on client disconnect
    """
    subscriber_id = _gen_id("sse")

    # Phase 1: Replay recent events for catch-up
    recent = await bus.get_recent(channel=channel, limit=replay_limit)
    for event in recent:
        if await request.is_disconnected():
            return
        yield _format_sse(event, replay=True)

    # Phase 2: Subscribe and stream live events
    sub = await bus.subscribe(subscriber_id, channel=channel)
    try:
        while True:
            if await request.is_disconnected():
                break

            try:
                event = await asyncio.wait_for(sub.queue.get(), timeout=30.0)
                yield _format_sse(event)
            except asyncio.TimeoutError:
                # Send keepalive comment to prevent connection timeout
                yield ": keepalive\n\n"
    finally:
        await bus.unsubscribe(subscriber_id)
        logger.debug("SSE client %s disconnected from channel %s", subscriber_id, channel)


def _format_sse(event: BusEvent, replay: bool = False) -> str:
    """Format a BusEvent as an SSE data frame."""
    data = event.to_dict()
    if replay:
        data["_replay"] = True
    return f"id: {event.id}\ndata: {json.dumps(data)}\n\n"


def create_sse_response(
    bus: AgentBus,
    channel: str,
    request: Request,
) -> StreamingResponse:
    """Create a StreamingResponse for SSE."""
    return StreamingResponse(
        sse_event_generator(bus, channel, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

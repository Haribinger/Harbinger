import asyncio

import pytest

from src.warroom.bus import (
    EVENT_AGENT_STATUS,
    EVENT_COMMAND_OUTPUT,
    EVENT_MISSION_UPDATE,
    EVENT_OPERATOR_ACTION,
    AgentBus,
    BusEvent,
)


@pytest.fixture
def bus():
    return AgentBus(ring_size=50)


# ── Bus core ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_publish_stores_in_ring(bus):
    await bus.publish(
        BusEvent(
            id="e1",
            type=EVENT_AGENT_STATUS,
            source="PATHFINDER",
            target="broadcast",
            channel="mission:1",
            payload={"status": "running"},
        )
    )
    assert bus.event_count == 1
    events = await bus.get_recent()
    assert len(events) == 1
    assert events[0].id == "e1"


@pytest.mark.asyncio
async def test_subscriber_receives_events(bus):
    sub = await bus.subscribe("sub1", channel="mission:1")

    await bus.publish(
        BusEvent(
            id="e1",
            type=EVENT_COMMAND_OUTPUT,
            source="BREACH",
            target="broadcast",
            channel="mission:1",
            payload={"data": "nuclei scan started"},
        )
    )

    event = await asyncio.wait_for(sub.queue.get(), timeout=1.0)
    assert event.id == "e1"
    assert event.payload["data"] == "nuclei scan started"


@pytest.mark.asyncio
async def test_subscriber_channel_filter(bus):
    sub1 = await bus.subscribe("sub1", channel="mission:1")
    sub2 = await bus.subscribe("sub2", channel="mission:2")

    await bus.publish(
        BusEvent(
            id="e1",
            type=EVENT_MISSION_UPDATE,
            source="system",
            target="broadcast",
            channel="mission:1",
            payload={},
        )
    )

    # sub1 should get the event (matching channel)
    event = await asyncio.wait_for(sub1.queue.get(), timeout=1.0)
    assert event.id == "e1"

    # sub2 should NOT get it (different channel)
    assert sub2.queue.empty()


@pytest.mark.asyncio
async def test_wildcard_subscriber_gets_all(bus):
    sub = await bus.subscribe("sub_all", channel="")

    await bus.publish(
        BusEvent(id="e1", type="test", source="a", target="b", channel="mission:1")
    )
    await bus.publish(
        BusEvent(id="e2", type="test", source="a", target="b", channel="mission:2")
    )

    e1 = await asyncio.wait_for(sub.queue.get(), timeout=1.0)
    e2 = await asyncio.wait_for(sub.queue.get(), timeout=1.0)
    assert e1.id == "e1"
    assert e2.id == "e2"


@pytest.mark.asyncio
async def test_unsubscribe_stops_delivery(bus):
    sub = await bus.subscribe("sub1", channel="mission:1")
    await bus.unsubscribe("sub1")

    await bus.publish(
        BusEvent(id="e1", type="test", source="a", target="b", channel="mission:1")
    )

    # Queue should be empty — we unsubscribed
    assert sub.queue.empty()


@pytest.mark.asyncio
async def test_ring_buffer_overflow(bus):
    # Ring size is 50 for this fixture
    for i in range(75):
        await bus.publish(
            BusEvent(
                id=f"e{i}", type="test", source="a", target="b", channel="c"
            )
        )

    assert bus.event_count == 50
    events = await bus.get_recent()
    assert events[0].id == "e25"  # oldest kept is e25 (75 - 50)
    assert events[-1].id == "e74"


@pytest.mark.asyncio
async def test_get_recent_with_channel_filter(bus):
    await bus.publish(
        BusEvent(id="m1", type="test", source="a", target="b", channel="mission:1")
    )
    await bus.publish(
        BusEvent(id="m2", type="test", source="a", target="b", channel="mission:2")
    )
    await bus.publish(
        BusEvent(id="m3", type="test", source="a", target="b", channel="mission:1")
    )

    events = await bus.get_recent(channel="mission:1")
    assert len(events) == 2
    assert events[0].id == "m1"
    assert events[1].id == "m3"


@pytest.mark.asyncio
async def test_slow_consumer_skipped(bus):
    # Create subscriber with tiny queue
    sub = await bus.subscribe("slow", channel="mission:1")
    # Fill the queue
    for i in range(100):
        await bus.publish(
            BusEvent(
                id=f"e{i}",
                type="test",
                source="a",
                target="b",
                channel="mission:1",
            )
        )

    # Queue is full (maxsize=100), no error raised — extras were dropped
    assert sub.queue.full()


@pytest.mark.asyncio
async def test_convenience_mission_event(bus):
    sub = await bus.subscribe("sub1", channel="mission:42")

    await bus.publish_mission_event(
        mission_id=42,
        event_type=EVENT_OPERATOR_ACTION,
        source="operator",
        payload={"action": "inject_command", "command": "nuclei -u test.com"},
    )

    event = await asyncio.wait_for(sub.queue.get(), timeout=1.0)
    assert event.channel == "mission:42"
    assert event.payload["action"] == "inject_command"


@pytest.mark.asyncio
async def test_convenience_agent_event(bus):
    sub = await bus.subscribe("sub1", channel="agent:PATHFINDER")

    await bus.publish_agent_event(
        agent_codename="PATHFINDER",
        event_type=EVENT_AGENT_STATUS,
        payload={"status": "executing", "task": "recon"},
    )

    event = await asyncio.wait_for(sub.queue.get(), timeout=1.0)
    assert event.source == "PATHFINDER"
    assert event.channel == "agent:PATHFINDER"


@pytest.mark.asyncio
async def test_event_to_dict(bus):
    event = BusEvent(
        id="e1",
        type="test",
        source="BREACH",
        target="broadcast",
        channel="mission:1",
        payload={"key": "value"},
        timestamp=1234567890.0,
    )
    d = event.to_dict()
    assert d["id"] == "e1"
    assert d["type"] == "test"
    assert d["payload"]["key"] == "value"
    assert d["timestamp"] == 1234567890.0


@pytest.mark.asyncio
async def test_subscriber_count(bus):
    assert bus.subscriber_count == 0
    await bus.subscribe("s1", channel="c1")
    await bus.subscribe("s2", channel="c2")
    assert bus.subscriber_count == 2
    await bus.unsubscribe("s1")
    assert bus.subscriber_count == 1

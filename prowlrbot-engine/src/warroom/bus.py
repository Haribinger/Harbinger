"""
AgentBus — Real-time event bus for agents within a mission.

Each mission gets its own logical channel. Subscribers receive events via
asyncio.Queue with non-blocking put (slow consumers are skipped). A ring
buffer holds the last N events per channel for late-joining clients.

This is the Python equivalent of the Go realtimeHub in realtime.go.
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class BusEvent:
    """Canonical event envelope for every SSE message in the platform."""

    id: str
    type: str  # agent_status, command_output, task_update, system_alert, etc.
    source: str  # agent codename or "system"
    target: str  # agent codename, operator ID, or "broadcast"
    channel: str  # logical channel: "mission:123", "agent:PATHFINDER", "system"
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "source": self.source,
            "target": self.target,
            "channel": self.channel,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }


@dataclass
class Subscriber:
    """One active SSE connection or internal consumer."""

    id: str
    channel: str  # empty = receive all channels
    queue: asyncio.Queue[BusEvent] = field(
        default_factory=lambda: asyncio.Queue(maxsize=100)
    )


# Event type constants
EVENT_AGENT_STATUS = "agent_status"
EVENT_COMMAND_OUTPUT = "command_output"
EVENT_TASK_UPDATE = "task_update"
EVENT_SUBTASK_UPDATE = "subtask_update"
EVENT_ACTION_LOG = "action_log"
EVENT_MISSION_UPDATE = "mission_update"
EVENT_OPERATOR_ACTION = "operator_action"
EVENT_SYSTEM_ALERT = "system_alert"

MAX_RING_BUFFER = 500
_counter = 0


def _gen_id(prefix: str = "evt") -> str:
    global _counter
    _counter += 1
    return f"{prefix}_{int(time.time() * 1000)}_{_counter}"


class AgentBus:
    """Central event bus for mission coordination."""

    def __init__(self, ring_size: int = MAX_RING_BUFFER):
        self._subscribers: dict[str, Subscriber] = {}
        self._ring: list[BusEvent] = []
        self._ring_size = ring_size
        self._lock = asyncio.Lock()

    async def publish(self, event: BusEvent) -> None:
        """Publish an event to all matching subscribers."""
        if not event.id:
            event.id = _gen_id()
        if not event.timestamp:
            event.timestamp = time.time()

        async with self._lock:
            # Ring buffer
            self._ring.append(event)
            if len(self._ring) > self._ring_size:
                self._ring = self._ring[-self._ring_size :]

            # Fan out to subscribers — non-blocking
            for sub in self._subscribers.values():
                if sub.channel and sub.channel != event.channel:
                    continue
                try:
                    sub.queue.put_nowait(event)
                except asyncio.QueueFull:
                    # Slow consumer — skip rather than block
                    pass

    async def subscribe(
        self, subscriber_id: str, channel: str = ""
    ) -> Subscriber:
        """Register a subscriber. Returns the Subscriber object."""
        sub = Subscriber(id=subscriber_id, channel=channel)
        async with self._lock:
            self._subscribers[subscriber_id] = sub
        return sub

    async def unsubscribe(self, subscriber_id: str) -> None:
        """Remove a subscriber."""
        async with self._lock:
            self._subscribers.pop(subscriber_id, None)

    async def get_recent(
        self, channel: str = "", limit: int = 50
    ) -> list[BusEvent]:
        """Get recent events from the ring buffer, optionally filtered."""
        async with self._lock:
            if channel:
                events = [e for e in self._ring if e.channel == channel]
            else:
                events = list(self._ring)
        return events[-limit:]

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    @property
    def event_count(self) -> int:
        return len(self._ring)

    async def publish_mission_event(
        self,
        mission_id: int,
        event_type: str,
        source: str,
        payload: dict[str, Any],
        target: str = "broadcast",
    ) -> None:
        """Convenience: publish to a mission channel."""
        await self.publish(
            BusEvent(
                id=_gen_id(),
                type=event_type,
                source=source,
                target=target,
                channel=f"mission:{mission_id}",
                payload=payload,
            )
        )

    async def publish_agent_event(
        self,
        agent_codename: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> None:
        """Convenience: publish to an agent channel."""
        await self.publish(
            BusEvent(
                id=_gen_id(),
                type=event_type,
                source=agent_codename,
                target="broadcast",
                channel=f"agent:{agent_codename}",
                payload=payload,
            )
        )


# Singleton — shared across the entire FastAPI process
agent_bus = AgentBus()

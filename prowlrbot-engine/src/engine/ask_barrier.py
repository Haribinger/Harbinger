"""Ask-User Barrier — pause/resume mechanism for operator input.

When an agent calls the 'ask' tool, the performer loop pauses via asyncio.Event
and waits for the operator to respond via HTTP endpoint or channel message.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PendingBarrier:
    """A single pending ask-user barrier."""

    subtask_id: str
    mission_id: str
    agent_codename: str
    question: str
    options: list[str] | None
    event: asyncio.Event = field(default_factory=asyncio.Event)
    response: str | None = None
    created_at: float = field(default_factory=time.time)


class AskUserBarrier:
    """Manages pending ask-user barriers across all active subtasks.

    Singleton — instantiated once at FastAPI startup and shared across
    all performer instances.
    """

    def __init__(self, timeout: float = 3600.0):
        self._pending: dict[str, PendingBarrier] = {}
        self._timeout = timeout  # 1 hour default
        self._on_ask_callbacks: list = []  # Notification callbacks

    def on_ask(self, callback):
        """Register a callback to be called when a barrier is created.

        Callback signature: async def callback(barrier: PendingBarrier)
        Used by channel bridge to send notifications.
        """
        self._on_ask_callbacks.append(callback)

    async def ask(
        self,
        subtask_id: str,
        mission_id: str,
        agent_codename: str,
        question: str,
        options: list[str] | None = None,
    ) -> str:
        """Pause execution and wait for operator response.

        Returns the operator's response text, or a timeout message.
        """
        barrier = PendingBarrier(
            subtask_id=subtask_id,
            mission_id=mission_id,
            agent_codename=agent_codename,
            question=question,
            options=options,
        )
        self._pending[subtask_id] = barrier
        logger.info(
            "Barrier created: subtask=%s agent=%s question=%s",
            subtask_id,
            agent_codename,
            question[:80],
        )

        # Notify all registered callbacks (channels, SSE, etc.)
        for cb in self._on_ask_callbacks:
            try:
                await cb(barrier)
            except Exception:
                logger.exception("Barrier notification callback failed")

        # Wait for response or timeout
        try:
            await asyncio.wait_for(barrier.event.wait(), timeout=self._timeout)
            response = barrier.response or "No response content."
            logger.info(
                "Barrier resolved: subtask=%s response=%s",
                subtask_id,
                response[:80],
            )
            return response
        except asyncio.TimeoutError:
            logger.warning(
                "Barrier timeout: subtask=%s (%.0fs)", subtask_id, self._timeout
            )
            return "No response from operator. Proceeding with best judgment."
        finally:
            self._pending.pop(subtask_id, None)

    def respond(self, subtask_id: str, response: str) -> bool:
        """Deliver operator response to a pending barrier.

        Returns True if the barrier was found and resolved, False if not found.
        """
        barrier = self._pending.get(subtask_id)
        if not barrier:
            return False
        barrier.response = response
        barrier.event.set()
        return True

    def list_pending(self) -> list[dict]:
        """Return all pending barriers as dicts (for API response)."""
        return [
            {
                "subtask_id": b.subtask_id,
                "mission_id": b.mission_id,
                "agent_codename": b.agent_codename,
                "question": b.question,
                "options": b.options,
                "created_at": b.created_at,
                "age_seconds": time.time() - b.created_at,
            }
            for b in self._pending.values()
        ]

    def get_pending(self, subtask_id: str) -> PendingBarrier | None:
        return self._pending.get(subtask_id)


# Global singleton — initialized once and shared across all performer instances
ask_barrier = AskUserBarrier()

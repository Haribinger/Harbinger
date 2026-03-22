"""Approval gates — pause task execution until operator approves."""
import asyncio
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ApprovalRequest:
    task_id: int
    mission_id: int
    agent: str
    title: str
    description: str
    risk_level: str = "high"  # low, medium, high, critical
    created_at: float = field(default_factory=time.time)
    resolved: bool = False
    approved: bool = False
    resolved_by: str = ""
    resolved_at: float = 0


class ApprovalGate:
    """Manages approval requests for high-risk tasks."""

    def __init__(self, timeout: float = 3600):
        self._pending: dict[int, ApprovalRequest] = {}  # task_id -> request
        self._events: dict[int, asyncio.Event] = {}  # task_id -> event
        self._timeout = timeout

    async def request_approval(self, task_id: int, mission_id: int, agent: str,
                                title: str, description: str, risk_level: str = "high") -> bool:
        """Request approval for a task. Blocks until approved/denied or timeout."""
        req = ApprovalRequest(
            task_id=task_id, mission_id=mission_id, agent=agent,
            title=title, description=description, risk_level=risk_level,
        )
        event = asyncio.Event()
        self._pending[task_id] = req
        self._events[task_id] = event

        logger.info("Approval requested for task %d (%s): %s", task_id, agent, title)

        try:
            await asyncio.wait_for(event.wait(), timeout=self._timeout)
            return req.approved
        except asyncio.TimeoutError:
            logger.warning("Approval timeout for task %d — auto-denying", task_id)
            req.resolved = True
            req.approved = False
            req.resolved_by = "timeout"
            return False
        finally:
            self._events.pop(task_id, None)

    def approve(self, task_id: int, approved_by: str = "operator") -> bool:
        """Approve a pending task."""
        req = self._pending.get(task_id)
        if not req or req.resolved:
            return False
        req.resolved = True
        req.approved = True
        req.resolved_by = approved_by
        req.resolved_at = time.time()
        event = self._events.get(task_id)
        if event:
            event.set()
        logger.info("Task %d approved by %s", task_id, approved_by)
        return True

    def deny(self, task_id: int, denied_by: str = "operator") -> bool:
        """Deny a pending task."""
        req = self._pending.get(task_id)
        if not req or req.resolved:
            return False
        req.resolved = True
        req.approved = False
        req.resolved_by = denied_by
        req.resolved_at = time.time()
        event = self._events.get(task_id)
        if event:
            event.set()
        logger.info("Task %d denied by %s", task_id, denied_by)
        return True

    def get_pending(self) -> list[dict]:
        return [
            {"task_id": r.task_id, "mission_id": r.mission_id, "agent": r.agent,
             "title": r.title, "risk_level": r.risk_level, "created_at": r.created_at}
            for r in self._pending.values() if not r.resolved
        ]

    def get_all(self, limit: int = 50) -> list[dict]:
        return [
            {"task_id": r.task_id, "mission_id": r.mission_id, "agent": r.agent,
             "title": r.title, "approved": r.approved, "resolved": r.resolved,
             "resolved_by": r.resolved_by}
            for r in list(self._pending.values())[-limit:]
        ]


# Singleton
approval_gate = ApprovalGate()

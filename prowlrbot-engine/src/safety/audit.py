"""Audit trail — log every action for compliance and review."""
import time
from dataclasses import dataclass, field


@dataclass
class AuditEntry:
    timestamp: float
    mission_id: int
    task_id: int
    agent: str
    action: str  # tool_call, approval, denial, restart, etc.
    tool_name: str = ""
    args_summary: str = ""
    result_summary: str = ""
    approved_by: str = ""


class AuditTrail:
    """Ring-buffered audit log for all agent actions."""

    def __init__(self, max_entries: int = 10000):
        self.entries: list[AuditEntry] = []
        self.max_entries = max_entries

    def log(self, mission_id: int, task_id: int, agent: str, action: str, **kwargs):
        entry = AuditEntry(
            timestamp=time.time(), mission_id=mission_id, task_id=task_id,
            agent=agent, action=action, **kwargs,
        )
        self.entries.append(entry)
        if len(self.entries) > self.max_entries:
            self.entries = self.entries[-self.max_entries:]
        return entry

    def get_entries(self, mission_id: int | None = None, limit: int = 100) -> list[dict]:
        entries = self.entries
        if mission_id is not None:
            entries = [e for e in entries if e.mission_id == mission_id]
        return [
            {"timestamp": e.timestamp, "mission_id": e.mission_id, "task_id": e.task_id,
             "agent": e.agent, "action": e.action, "tool": e.tool_name,
             "args": e.args_summary, "result": e.result_summary[:200]}
            for e in entries[-limit:]
        ]


# Singleton
audit_trail = AuditTrail()

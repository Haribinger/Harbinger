"""Kill switch — emergency halt for missions, agents, or entire platform."""
import asyncio
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class KillEvent:
    timestamp: float
    scope: str  # "global", "mission:{id}", "agent:{codename}", "task:{id}"
    reason: str
    initiated_by: str = "operator"


class KillSwitch:
    """Global and per-mission kill switch."""

    def __init__(self):
        self._global_halt = False
        self._halted_missions: set[int] = set()
        self._halted_agents: set[str] = set()
        self._events: list[KillEvent] = []

    @property
    def global_halt(self) -> bool:
        return self._global_halt

    def activate_global(self, reason: str = "emergency", initiated_by: str = "operator"):
        """Halt ALL operations immediately."""
        self._global_halt = True
        self._events.append(KillEvent(time.time(), "global", reason, initiated_by))
        logger.critical("GLOBAL KILL SWITCH ACTIVATED: %s (by %s)", reason, initiated_by)

    def deactivate_global(self, initiated_by: str = "operator"):
        """Resume operations after global halt."""
        self._global_halt = False
        self._events.append(KillEvent(time.time(), "global", "deactivated", initiated_by))
        logger.info("Global kill switch deactivated by %s", initiated_by)

    def halt_mission(self, mission_id: int, reason: str = "", initiated_by: str = "operator"):
        """Halt a specific mission."""
        self._halted_missions.add(mission_id)
        self._events.append(KillEvent(time.time(), f"mission:{mission_id}", reason, initiated_by))
        logger.warning("Mission %d halted: %s", mission_id, reason)

    def resume_mission(self, mission_id: int):
        self._halted_missions.discard(mission_id)

    def halt_agent(self, codename: str, reason: str = ""):
        self._halted_agents.add(codename.upper())
        self._events.append(KillEvent(time.time(), f"agent:{codename}", reason))

    def resume_agent(self, codename: str):
        self._halted_agents.discard(codename.upper())

    def is_halted(self, mission_id: int | None = None, agent: str | None = None) -> bool:
        """Check if execution should stop."""
        if self._global_halt:
            return True
        if mission_id and mission_id in self._halted_missions:
            return True
        if agent and agent.upper() in self._halted_agents:
            return True
        return False

    def get_events(self, limit: int = 50) -> list[dict]:
        return [
            {"timestamp": e.timestamp, "scope": e.scope, "reason": e.reason, "by": e.initiated_by}
            for e in self._events[-limit:]
        ]

    @property
    def status(self) -> dict:
        return {
            "global_halt": self._global_halt,
            "halted_missions": list(self._halted_missions),
            "halted_agents": list(self._halted_agents),
            "total_events": len(self._events),
        }


# Singleton
kill_switch = KillSwitch()

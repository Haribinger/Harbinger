"""Self-healing monitor — detect failures, diagnose, restart selectively."""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Diagnosis:
    reason: str
    root_cause: str
    auto_fixable: bool
    fix_type: str  # restart, oom, config, manual
    suggested_fix: str
    severity: str  # low, medium, high, critical


@dataclass
class HealingEvent:
    timestamp: float
    task_id: int
    agent: str
    event_type: str  # container_failure, timeout, stall, restart, diagnosis
    details: dict = field(default_factory=dict)


class SelfHealingMonitor:
    """Monitors running agents. Detects failures, diagnoses, restarts."""

    def __init__(self, check_interval: int = 15):
        self.check_interval = check_interval
        self.events: list[HealingEvent] = []
        self._running = False

    def check_stall(self, last_action_age: float, threshold: float = 120) -> str:
        if last_action_age > threshold:
            return "stalled"
        return "ok"

    def check_container_health(self, state: dict) -> str:
        if not state.get("Running", False):
            return "dead"
        if state.get("OOMKilled", False):
            return "oom"
        return "healthy"

    async def diagnose_failure(self, agent: str, logs: str, exit_code: int,
                                oom_killed: bool, error: str, llm=None) -> Diagnosis:
        if oom_killed:
            return Diagnosis(
                reason="Container killed by OOM",
                root_cause="Memory limit exceeded",
                auto_fixable=True, fix_type="oom",
                suggested_fix="Restart with higher memory limit",
                severity="high",
            )
        if exit_code == 137:
            return Diagnosis(
                reason="Container killed (SIGKILL)",
                root_cause="OOM or external kill",
                auto_fixable=True, fix_type="restart",
                suggested_fix="Restart container",
                severity="high",
            )
        if exit_code != 0 and "command not found" in (logs or ""):
            return Diagnosis(
                reason="Tool not installed",
                root_cause=f"Missing binary (exit {exit_code})",
                auto_fixable=False, fix_type="manual",
                suggested_fix="Install missing tool or use different Docker image",
                severity="medium",
            )

        # LLM-powered diagnosis for unknown failures
        if llm and logs:
            try:
                prompt = (
                    f"Diagnose this container failure:\n"
                    f"Agent: {agent}\nExit code: {exit_code}\nOOM: {oom_killed}\nError: {error}\n"
                    f"Logs (last 50 lines):\n{logs[-3000:]}\n\n"
                    f"Respond with JSON: {{\"reason\": str, \"root_cause\": str, "
                    f"\"auto_fixable\": bool, \"fix_type\": str, \"suggested_fix\": str, \"severity\": str}}"
                )
                result = await llm.call_with_tools([{"role": "user", "content": prompt}])
                import json
                data = json.loads(result.get("content", "{}"))
                return Diagnosis(**data)
            except Exception as e:
                logger.warning("LLM diagnosis failed: %s", e)

        return Diagnosis(
            reason=error or f"Unknown failure (exit {exit_code})",
            root_cause="Unknown",
            auto_fixable=exit_code in (1, 2, 139),
            fix_type="restart" if exit_code in (1, 2, 139) else "manual",
            suggested_fix="Restart container" if exit_code in (1, 2, 139) else "Check logs manually",
            severity="high",
        )

    def record_event(self, task_id: int, agent: str, event_type: str, details: dict = None):
        event = HealingEvent(
            timestamp=time.time(), task_id=task_id, agent=agent,
            event_type=event_type, details=details or {},
        )
        self.events.append(event)
        # Ring buffer: keep last 1000 events
        if len(self.events) > 1000:
            self.events = self.events[-1000:]
        return event

    def get_events(self, limit: int = 50) -> list[dict]:
        return [
            {"timestamp": e.timestamp, "task_id": e.task_id, "agent": e.agent,
             "type": e.event_type, "details": e.details}
            for e in self.events[-limit:]
        ]


# Singleton
healing_monitor = SelfHealingMonitor()

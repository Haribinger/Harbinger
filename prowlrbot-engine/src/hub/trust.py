"""Trust scoring engine — rates agents for delegation priority.

Trust tiers: builtin(100), verified(80), community(50), unknown(20), restricted(0)
Performance bonuses: +3 per successful task (max +30)
Failure penalties: -10 per failed task (no cap)
Timeout penalties: -5 per timed-out task
"""
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

TIER_SCORES = {
    "builtin": 100,
    "verified": 80,
    "community": 50,
    "unknown": 20,
    "restricted": 0,
}

MAX_PERFORMANCE_BONUS = 30


@dataclass
class TrustRecord:
    agent_id: str
    tier: str = "unknown"
    base_score: int = 20
    successful_tasks: int = 0
    failed_tasks: int = 0
    timed_out_tasks: int = 0
    total_tasks: int = 0
    last_task_at: float = 0
    approved_by_operator: bool = False

    @property
    def performance_bonus(self) -> int:
        return min(self.successful_tasks * 3, MAX_PERFORMANCE_BONUS)

    @property
    def failure_penalty(self) -> int:
        # No cap — every failure counts
        return self.failed_tasks * 10

    @property
    def timeout_penalty(self) -> int:
        return self.timed_out_tasks * 5

    @property
    def score(self) -> int:
        return max(0, self.base_score + self.performance_bonus - self.failure_penalty - self.timeout_penalty)

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "tier": self.tier,
            "base_score": self.base_score,
            "score": self.score,
            "successful_tasks": self.successful_tasks,
            "failed_tasks": self.failed_tasks,
            "timed_out_tasks": self.timed_out_tasks,
            "total_tasks": self.total_tasks,
            "performance_bonus": self.performance_bonus,
            "failure_penalty": self.failure_penalty,
            "timeout_penalty": self.timeout_penalty,
            "last_task_at": self.last_task_at,
            "approved_by_operator": self.approved_by_operator,
        }


class TrustEngine:
    """Manages trust scores for all agents."""

    def __init__(self):
        self._records: dict[str, TrustRecord] = {}
        # Initialize built-in agents
        from src.registry.agents import BUILTIN_AGENTS
        for agent in BUILTIN_AGENTS:
            self._records[agent.codename] = TrustRecord(
                agent_id=agent.codename,
                tier="builtin",
                base_score=TIER_SCORES["builtin"],
            )

    def get(self, agent_id: str) -> TrustRecord | None:
        return self._records.get(agent_id.upper())

    def get_score(self, agent_id: str) -> int:
        record = self.get(agent_id)
        return record.score if record else 0

    def register(self, agent_id: str, tier: str = "unknown"):
        base = TIER_SCORES.get(tier, 20)
        self._records[agent_id.upper()] = TrustRecord(
            agent_id=agent_id.upper(),
            tier=tier,
            base_score=base,
        )

    def record_success(self, agent_id: str):
        record = self.get(agent_id)
        if record:
            record.successful_tasks += 1
            record.total_tasks += 1
            record.last_task_at = time.time()

    def record_failure(self, agent_id: str):
        record = self.get(agent_id)
        if record:
            record.failed_tasks += 1
            record.total_tasks += 1
            record.last_task_at = time.time()

    def record_timeout(self, agent_id: str):
        record = self.get(agent_id)
        if record:
            record.timed_out_tasks += 1
            record.total_tasks += 1
            record.last_task_at = time.time()

    def set_tier(self, agent_id: str, tier: str):
        record = self.get(agent_id)
        if record and tier in TIER_SCORES:
            record.tier = tier
            record.base_score = TIER_SCORES[tier]

    def approve(self, agent_id: str):
        record = self.get(agent_id)
        if record:
            record.approved_by_operator = True

    def needs_approval(self, agent_id: str) -> bool:
        record = self.get(agent_id)
        if not record:
            return True
        if record.tier in ("builtin", "verified"):
            return False
        if record.tier == "community" and record.approved_by_operator:
            return False
        return True

    def rank_candidates(self, candidates: list[str]) -> list[dict]:
        """Rank agent candidates by trust score (highest first)."""
        ranked = []
        for agent_id in candidates:
            record = self.get(agent_id)
            if record and record.tier != "restricted":
                ranked.append(record.to_dict())
        ranked.sort(key=lambda r: r["score"], reverse=True)
        return ranked

    def list_all(self) -> list[dict]:
        return [r.to_dict() for r in self._records.values()]


# Singleton
trust_engine = TrustEngine()

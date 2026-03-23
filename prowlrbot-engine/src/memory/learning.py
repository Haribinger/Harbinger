"""Persistent learning — episodic, semantic, and strategic memory for agents.

Three memory types:
  - Episodic: "I ran nuclei on Apache 2.4, found CVE-X" (what happened)
  - Semantic: "Apache Struts is commonly vulnerable to RCE" (general knowledge)
  - Strategic: "Against WAF X, use technique Y instead of Z" (learned strategies)
"""
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Episode:
    """A single agent experience — what was tried and what happened."""
    id: str
    agent: str
    mission_id: int
    task_title: str
    tool_used: str
    command: str
    target_type: str  # "web_app", "api", "network", "cloud"
    success: bool
    result_summary: str
    duration_s: float = 0
    false_positive: bool = False
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "agent": self.agent, "mission_id": self.mission_id,
            "task_title": self.task_title, "tool_used": self.tool_used,
            "command": self.command, "target_type": self.target_type,
            "success": self.success, "result_summary": self.result_summary,
            "duration_s": self.duration_s, "false_positive": self.false_positive,
            "timestamp": self.timestamp,
        }


@dataclass
class Strategy:
    """A learned strategy — what to do in specific situations."""
    id: str
    condition: str  # "target uses Cloudflare WAF"
    action: str  # "use dalfox instead of nuclei for XSS"
    effectiveness: float  # 0.0-1.0 success rate
    sample_size: int  # how many times tested
    agent: str = ""
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "condition": self.condition, "action": self.action,
            "effectiveness": self.effectiveness, "sample_size": self.sample_size,
            "agent": self.agent, "created_at": self.created_at,
        }


class LearningEngine:
    """Manages agent learning across missions."""

    def __init__(self):
        self._episodes: list[Episode] = []
        self._strategies: list[Strategy] = []
        self._false_positive_patterns: dict[str, int] = {}  # pattern → count

    def record_episode(self, episode: Episode):
        self._episodes.append(episode)
        # Ring-buffer — keep the 10k most recent episodes to bound memory
        if len(self._episodes) > 10000:
            self._episodes = self._episodes[-10000:]
        if episode.false_positive:
            self._false_positive_patterns[episode.result_summary[:100]] = \
                self._false_positive_patterns.get(episode.result_summary[:100], 0) + 1

    def record_strategy(self, strategy: Strategy):
        # Update existing or add new
        for i, s in enumerate(self._strategies):
            if s.id == strategy.id:
                self._strategies[i] = strategy
                return
        self._strategies.append(strategy)

    def get_tool_effectiveness(self, tool: str, target_type: str = "") -> dict:
        """How effective is a tool? Based on past episodes."""
        relevant = [e for e in self._episodes if e.tool_used == tool]
        if target_type:
            relevant = [e for e in relevant if e.target_type == target_type]
        if not relevant:
            return {"tool": tool, "episodes": 0, "success_rate": 0.0}
        successes = sum(1 for e in relevant if e.success)
        return {
            "tool": tool,
            "target_type": target_type,
            "episodes": len(relevant),
            "success_rate": successes / len(relevant),
            "avg_duration": sum(e.duration_s for e in relevant) / len(relevant),
            "false_positive_rate": sum(1 for e in relevant if e.false_positive) / len(relevant),
        }

    def get_strategies_for(self, condition: str) -> list[dict]:
        """Get learned strategies matching a condition."""
        return [
            s.to_dict() for s in self._strategies
            if condition.lower() in s.condition.lower()
        ]

    def get_false_positive_patterns(self, min_count: int = 2) -> list[dict]:
        """Patterns that are frequently false positives."""
        return [
            {"pattern": p, "count": c}
            for p, c in sorted(self._false_positive_patterns.items(), key=lambda x: -x[1])
            if c >= min_count
        ]

    def get_agent_stats(self, agent: str) -> dict:
        """Per-agent learning stats."""
        episodes = [e for e in self._episodes if e.agent == agent]
        if not episodes:
            return {"agent": agent, "episodes": 0}
        tools_used = {}
        for e in episodes:
            tools_used[e.tool_used] = tools_used.get(e.tool_used, 0) + 1
        return {
            "agent": agent,
            "episodes": len(episodes),
            "success_rate": sum(1 for e in episodes if e.success) / len(episodes),
            "false_positive_rate": sum(1 for e in episodes if e.false_positive) / len(episodes),
            "top_tools": sorted(tools_used.items(), key=lambda x: -x[1])[:5],
            "avg_duration": sum(e.duration_s for e in episodes) / len(episodes),
        }

    def suggest_approach(self, target_type: str, task_type: str) -> dict:
        """Based on past learning, suggest best approach for a task."""
        relevant = [e for e in self._episodes if e.target_type == target_type and e.success]
        if not relevant:
            return {"suggestion": "No past experience with this target type", "confidence": 0}

        # Find most effective tools
        tool_scores: dict[str, dict] = {}
        for e in relevant:
            if e.tool_used not in tool_scores:
                tool_scores[e.tool_used] = {"successes": 0, "total": 0}
            tool_scores[e.tool_used]["successes"] += 1
            tool_scores[e.tool_used]["total"] += 1

        best_tools = sorted(
            tool_scores.items(),
            key=lambda x: x[1]["successes"] / max(x[1]["total"], 1),
            reverse=True,
        )[:3]

        strategies = [s for s in self._strategies if target_type.lower() in s.condition.lower()]

        return {
            "target_type": target_type,
            "recommended_tools": [t[0] for t in best_tools],
            "strategies": [s.to_dict() for s in strategies[:3]],
            "based_on_episodes": len(relevant),
            # Confidence grows with sample size, caps at 1.0
            "confidence": min(len(relevant) / 10, 1.0),
        }


# Singleton
learning_engine = LearningEngine()

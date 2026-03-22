"""Observability — Langfuse tracing for mission execution."""
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Try to import langfuse, graceful fallback if not installed
try:
    from langfuse import Langfuse
    LANGFUSE_AVAILABLE = True
except ImportError:
    LANGFUSE_AVAILABLE = False
    Langfuse = None


@dataclass
class TraceContext:
    """Tracks a mission execution trace."""
    mission_id: int
    trace_id: str | None = None
    spans: dict = field(default_factory=dict)  # task_id -> span
    _client: Any = None

    def log_tool_call(self, task_id: int, subtask_id: int, tool_name: str,
                       args: dict, result: str, duration: float):
        """Log a tool execution to the trace."""
        if self._client and self.trace_id:
            try:
                self._client.generation(
                    trace_id=self.trace_id,
                    name=f"tool:{tool_name}",
                    input=args,
                    output=result[:1000],
                    metadata={
                        "mission_id": self.mission_id,
                        "task_id": task_id,
                        "subtask_id": subtask_id,
                        "duration_s": duration,
                    },
                )
            except Exception as e:
                logger.debug("Langfuse log failed: %s", e)

    def log_agent_call(self, task_id: int, agent: str, model: str,
                        tokens_in: int, tokens_out: int):
        if self._client and self.trace_id:
            try:
                self._client.generation(
                    trace_id=self.trace_id,
                    name=f"agent:{agent}",
                    model=model,
                    usage={"input": tokens_in, "output": tokens_out},
                    metadata={"mission_id": self.mission_id, "task_id": task_id},
                )
            except Exception as e:
                logger.debug("Langfuse log failed: %s", e)


class ObservabilityManager:
    """Manages Langfuse client and trace creation."""

    def __init__(self):
        self._client = None
        if LANGFUSE_AVAILABLE and os.getenv("LANGFUSE_PUBLIC_KEY"):
            try:
                self._client = Langfuse(
                    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                    host=os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com"),
                )
                logger.info("Langfuse observability enabled")
            except Exception as e:
                logger.warning("Langfuse init failed: %s", e)
        else:
            logger.info("Langfuse not configured — observability disabled")

    def create_trace(self, mission_id: int, title: str, user_id: str = "") -> TraceContext:
        ctx = TraceContext(mission_id=mission_id)
        if self._client:
            try:
                trace = self._client.trace(
                    name=title,
                    session_id=f"mission-{mission_id}",
                    user_id=user_id,
                    metadata={"mission_id": mission_id},
                )
                ctx.trace_id = trace.id
                ctx._client = self._client
            except Exception as e:
                logger.debug("Trace creation failed: %s", e)
        return ctx

    @property
    def enabled(self) -> bool:
        return self._client is not None


# Singleton
observability = ObservabilityManager()

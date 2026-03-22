"""
Execution monitor for the ReAct agent loop.

Detects two failure modes that cause agents to spin indefinitely:
  1. Same-tool loops   — the agent calls the same tool N times without progress
  2. Runaway execution — total call count exceeds a hard ceiling

When a loop is detected the monitor returns "adviser" so the orchestrator can
inject a corrective prompt rather than just killing the run. When the total
ceiling is hit it returns "abort" — no recovery, the run is dead.

Inspired by PentAGI's helpers.go loop-detection pattern.
"""


class ExecutionMonitor:
    def __init__(self, same_tool_limit: int = 50, total_limit: int = 100):
        # How many consecutive calls to the same tool trigger an adviser intervention
        self.same_tool_limit = same_tool_limit
        # Hard ceiling across all tool calls for this run
        self.total_limit = total_limit

        self._same_count = 0
        self._total_count = 0
        self._last_tool = ""

    def check(self, tool_name: str) -> str:
        """
        Record a tool call and return the agent's allowed action.

        Returns:
            "ok"      — proceed normally
            "adviser" — same-tool loop detected; orchestrator should intervene
            "abort"   — total call ceiling reached; terminate the run
        """
        self._total_count += 1

        # Track consecutive same-tool streak; reset on tool change
        if tool_name == self._last_tool:
            self._same_count += 1
        else:
            self._same_count = 1
            self._last_tool = tool_name

        # Total limit is checked before same-tool so a saturated run aborts cleanly
        if self._total_count >= self.total_limit:
            return "abort"

        if self._same_count >= self.same_tool_limit:
            # Reset streak so adviser fires once per N calls, not every call after
            self._same_count = 0
            return "adviser"

        return "ok"

    @property
    def stats(self) -> dict:
        """Snapshot of current monitor state for logging/telemetry."""
        return {
            "total_calls": self._total_count,
            "same_tool_streak": self._same_count,
            "last_tool": self._last_tool,
        }

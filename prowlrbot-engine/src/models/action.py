from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Action(Base):
    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    subtask_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("subtasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Unique call ID from the LLM tool-call request (for deduplication/tracing)
    call_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Name of the MCP/tool invoked (e.g. "run_command", "http_request")
    tool_name: Mapped[str] = mapped_column(String(128), nullable=False)
    # Arguments passed to the tool
    args: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Raw output returned by the tool
    result: Mapped[str | None] = mapped_column(JSON, nullable=True)
    # "text", "json", "binary", "error"
    result_format: Mapped[str] = mapped_column(String(32), nullable=False, default="text")
    # pending, running, completed, failed, timeout
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    # Wall-clock seconds the tool call took — used to calculate agent efficiency
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Denormalised for fast per-mission action queries without joining up the tree
    mission_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    task_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    subtask: Mapped["SubTask"] = relationship("SubTask", back_populates="actions")  # noqa: F821

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class SubTask(Base):
    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # created, running, completed, failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    # Raw text or markdown result from the subtask
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Freeform context blob injected into the agent's prompt for this subtask
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Links to the LLM message chain that drove this subtask (for replay/audit)
    msg_chain_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="subtasks")  # noqa: F821
    actions: Mapped[list["Action"]] = relationship(  # noqa: F821
        "Action",
        back_populates="subtask",
        cascade="all, delete-orphan",
        order_by="Action.created_at",
    )

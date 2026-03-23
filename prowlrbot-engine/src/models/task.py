from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mission_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # created, queued, running, completed, failed, skipped, blocked
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    # Which agent archetype handles this task
    agent_codename: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Docker image for the agent container (e.g. "harbinger/breach:latest")
    docker_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Running container ID once spawned
    container_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # List of task IDs this task depends on before it can run
    depends_on: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Whether a human must approve this task before execution
    approval_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Higher = runs sooner when tasks are unblocked
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Freeform input passed to the agent at task start
    input: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Structured result returned by the agent on completion
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Visual ordering within the mission's task list
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    mission: Mapped["Mission"] = relationship("Mission", back_populates="tasks")  # noqa: F821
    subtasks: Mapped[list["SubTask"]] = relationship(  # noqa: F821
        "SubTask", back_populates="task", cascade="all, delete-orphan", order_by="SubTask.position"
    )

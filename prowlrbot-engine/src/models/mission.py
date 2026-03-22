from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # created, running, paused, completed, failed, cancelled
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    # custom, recon, web, cloud, osint, binary, redteam
    mission_type: Mapped[str] = mapped_column(String(50), nullable=False, default="custom")
    target: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # {"include": [...], "exclude": [...], "wildcards": [...]}
    scope: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # 0=manual, 1=semi-auto, 2=full-auto
    autonomy_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # distributed tracing — links all agent actions for this mission
    trace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(  # noqa: F821
        "Task", back_populates="mission", cascade="all, delete-orphan", order_by="Task.position"
    )

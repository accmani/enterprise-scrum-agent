from sqlalchemy import String, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.database import Base


class AgentMetric(Base):
    """Records every agent invocation for performance monitoring and analytics."""
    __tablename__ = "agent_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    persona: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    super_agent: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    query_preview: Mapped[str] = mapped_column(String(200))
    query_category: Mapped[str] = mapped_column(String(50))  # planning | engineering | qa | delivery
    tools_invoked: Mapped[str | None] = mapped_column(Text)   # comma-separated tool names from response
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    is_defect_fix: Mapped[bool] = mapped_column(Boolean, default=False)
    defect_severity: Mapped[str | None] = mapped_column(String(20))  # critical | high | medium | low
    defect_category: Mapped[str | None] = mapped_column(String(50))  # null-check | logic | concurrency | etc.
    session_id: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

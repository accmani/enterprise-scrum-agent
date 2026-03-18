from sqlalchemy import String, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import enum

from app.database import Base


class SprintStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    REVIEW = "review"
    COMPLETED = "completed"


class Sprint(Base):
    __tablename__ = "sprints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    goal: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[SprintStatus] = mapped_column(
        SAEnum(SprintStatus), default=SprintStatus.PLANNING
    )
    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    velocity: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    stories: Mapped[list["Story"]] = relationship("Story", back_populates="sprint")

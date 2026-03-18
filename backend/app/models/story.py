from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import enum

from app.database import Base


class StoryStatus(str, enum.Enum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class StorySizeEnum(str, enum.Enum):
    XS = "XS"
    S = "S"
    M = "M"
    L = "L"
    XL = "XL"


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    acceptance_criteria: Mapped[str | None] = mapped_column(Text)
    story_points: Mapped[float | None] = mapped_column(Float)
    size: Mapped[StorySizeEnum | None] = mapped_column(SAEnum(StorySizeEnum))
    status: Mapped[StoryStatus] = mapped_column(
        SAEnum(StoryStatus), default=StoryStatus.BACKLOG
    )
    assignee: Mapped[str | None] = mapped_column(String(100))
    sprint_id: Mapped[int | None] = mapped_column(ForeignKey("sprints.id"))
    jira_key: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    sprint: Mapped["Sprint | None"] = relationship("Sprint", back_populates="stories")

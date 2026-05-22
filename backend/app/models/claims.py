"""
Healthcare Claims data model — used for the DB use-case demonstration.
Seeded with realistic data including records affected by BUG-001 through BUG-008.
"""
import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ClaimStatus(str, enum.Enum):
    APPROVED = "approved"
    DENIED = "denied"
    PENDING = "pending"
    FLAGGED = "flagged"


class ServiceType(str, enum.Enum):
    PRIMARY_CARE = "primary_care"
    SPECIALIST = "specialist"
    EMERGENCY = "emergency"
    INPATIENT = "inpatient"
    OUTPATIENT = "outpatient"
    PHARMACY = "pharmacy"


class HealthcareClaim(Base):
    __tablename__ = "healthcare_claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    claim_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    member_id: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    member_name: Mapped[str] = mapped_column(String(100))
    provider_name: Mapped[str] = mapped_column(String(100))
    service_type: Mapped[ServiceType] = mapped_column(SAEnum(ServiceType))
    service_date: Mapped[datetime] = mapped_column(DateTime)
    billed_amount: Mapped[float] = mapped_column(Float)
    approved_amount: Mapped[float | None] = mapped_column(Float)
    patient_responsibility: Mapped[float | None] = mapped_column(Float)
    deductible_applied: Mapped[float | None] = mapped_column(Float)
    copay_amount: Mapped[float | None] = mapped_column(Float)
    status: Mapped[ClaimStatus] = mapped_column(SAEnum(ClaimStatus), default=ClaimStatus.PENDING)
    denial_reason: Mapped[str | None] = mapped_column(Text)
    icd10_code: Mapped[str | None] = mapped_column(String(20))
    cpt_code: Mapped[str | None] = mapped_column(String(20))
    has_prior_auth: Mapped[bool] = mapped_column(Boolean, default=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str | None] = mapped_column(Text)
    # Tracks which seeded bug scenario this record demonstrates
    bug_scenario: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

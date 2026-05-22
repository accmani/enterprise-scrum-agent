from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select

from app.config import settings


engine = create_async_engine(settings.database_url, echo=settings.debug)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_claims():
    """
    Seeds the healthcare_claims table with 60 realistic records on first run.
    Records are distributed across all 8 bug scenarios for demo purposes.
    """
    from app.models.claims import HealthcareClaim, ClaimStatus, ServiceType

    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(HealthcareClaim).limit(1))
        if existing.scalar_one_or_none() is not None:
            return  # Already seeded

        base_date = datetime(2024, 1, 1)
        claims = []

        # ── Normal approved claims (15 records) ───────────────────────────
        normal_data = [
            ("CLM-001", "MEM-101", "Alice Johnson",   "City Medical",    ServiceType.PRIMARY_CARE, 250.00, 200.00, 30.00, 0.00,  20.00,  None),
            ("CLM-002", "MEM-102", "Bob Smith",       "Sunrise Clinic",  ServiceType.SPECIALIST,   400.00, 350.00, 50.00, 0.00,  50.00,  None),
            ("CLM-003", "MEM-103", "Carol White",     "Metro Hospital",  ServiceType.OUTPATIENT,   800.00, 720.00, 80.00, 0.00,  0.00,   None),
            ("CLM-004", "MEM-104", "David Lee",       "Pharma Plus",     ServiceType.PHARMACY,      60.00,  55.00,  5.00, 0.00,  0.00,   None),
            ("CLM-005", "MEM-105", "Emma Davis",      "City Medical",    ServiceType.PRIMARY_CARE, 180.00, 160.00, 20.00, 0.00,  20.00,  None),
            ("CLM-006", "MEM-106", "Frank Brown",     "Sunrise Clinic",  ServiceType.SPECIALIST,   520.00, 470.00, 50.00, 0.00,  50.00,  None),
            ("CLM-007", "MEM-107", "Grace Wilson",    "Metro Hospital",  ServiceType.INPATIENT,   3200.00,2900.00,300.00, 0.00,  0.00,   None),
            ("CLM-008", "MEM-108", "Henry Taylor",    "City Medical",    ServiceType.PRIMARY_CARE, 220.00, 200.00, 20.00, 0.00,  20.00,  None),
            ("CLM-009", "MEM-109", "Iris Martin",     "Pharma Plus",     ServiceType.PHARMACY,     120.00, 100.00, 20.00, 0.00,  0.00,   None),
            ("CLM-010", "MEM-110", "Jack Anderson",   "Sunrise Clinic",  ServiceType.OUTPATIENT,   650.00, 600.00, 50.00, 0.00,  0.00,   None),
            ("CLM-011", "MEM-111", "Karen Thomas",    "City Medical",    ServiceType.PRIMARY_CARE, 190.00, 170.00, 20.00, 0.00,  20.00,  None),
            ("CLM-012", "MEM-112", "Liam Jackson",    "Metro Hospital",  ServiceType.SPECIALIST,   480.00, 430.00, 50.00, 0.00,  50.00,  None),
            ("CLM-013", "MEM-113", "Mia Harris",      "City Medical",    ServiceType.PRIMARY_CARE, 210.00, 190.00, 20.00, 0.00,  20.00,  None),
            ("CLM-014", "MEM-114", "Noah Martinez",   "Pharma Plus",     ServiceType.PHARMACY,      90.00,  80.00, 10.00, 0.00,  0.00,   None),
            ("CLM-015", "MEM-115", "Olivia Garcia",   "Metro Hospital",  ServiceType.OUTPATIENT,   550.00, 500.00, 50.00, 0.00,  0.00,   None),
        ]
        for i, (cid, mid, name, prov, stype, billed, approved, resp, ded, copay, bug) in enumerate(normal_data):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name=prov,
                service_type=stype, service_date=base_date + timedelta(days=i),
                billed_amount=billed, approved_amount=approved, patient_responsibility=resp,
                deductible_applied=ded, copay_amount=copay,
                status=ClaimStatus.APPROVED, icd10_code="Z00.00", cpt_code="99213",
                has_prior_auth=(stype == ServiceType.SPECIALIST), bug_scenario=bug,
            ))

        # ── BUG-001: NullPointerException — no coverage (5 records) ───────
        bug001_members = [
            ("CLM-101", "MEM-901", "Peter Quinn",    550.00),
            ("CLM-102", "MEM-902", "Rachel Stone",   320.00),
            ("CLM-103", "MEM-903", "Samuel Torres",  780.00),
            ("CLM-104", "MEM-904", "Tina Nguyen",    410.00),
            ("CLM-105", "MEM-905", "Uma Patel",      290.00),
        ]
        for i, (cid, mid, name, billed) in enumerate(bug001_members):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="City Medical",
                service_type=ServiceType.PRIMARY_CARE,
                service_date=base_date + timedelta(days=30 + i),
                billed_amount=billed, status=ClaimStatus.DENIED,
                denial_reason="NullPointerException: No coverage record found for member",
                is_flagged=True, flag_reason="BUG-001: NPE — null coverage not handled",
                bug_scenario="BUG-001",
            ))

        # ── BUG-002: Deductible off-by-one overcharge (7 records) ─────────
        bug002_data = [
            ("CLM-201", "MEM-201", "Victor Russo",   400.00, 400.00, 150.00, 400.00, 50.00),
            ("CLM-202", "MEM-202", "Wendy Kim",      300.00, 300.00, 120.00, 300.00, 20.00),
            ("CLM-203", "MEM-203", "Xavier Reyes",   600.00, 600.00, 200.00, 600.00, 50.00),
            ("CLM-204", "MEM-204", "Yara Singh",     250.00, 250.00,  90.00, 250.00, 20.00),
            ("CLM-205", "MEM-205", "Zach Murphy",    450.00, 450.00, 160.00, 450.00, 50.00),
            ("CLM-206", "MEM-206", "Amy Chen",       350.00, 350.00, 130.00, 350.00, 20.00),
            ("CLM-207", "MEM-207", "Brian Foster",   500.00, 500.00, 180.00, 500.00, 50.00),
        ]
        for i, (cid, mid, name, billed, approved, resp, ded, copay) in enumerate(bug002_data):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="Metro Hospital",
                service_type=ServiceType.OUTPATIENT,
                service_date=base_date + timedelta(days=45 + i),
                billed_amount=billed, approved_amount=approved, patient_responsibility=resp,
                deductible_applied=ded, copay_amount=copay,
                status=ClaimStatus.FLAGGED, icd10_code="J18.9", cpt_code="99214",
                is_flagged=True,
                flag_reason="BUG-002: Deductible exactly met but patient charged again (> vs >=)",
                bug_scenario="BUG-002",
            ))

        # ── BUG-003: Batch ConcurrentModificationException (5 pending) ────
        bug003_members = [
            ("CLM-301", "MEM-301", "Chris Evans",   720.00),
            ("CLM-302", "MEM-302", "Diana Prince",  450.00),
            ("CLM-303", "MEM-303", "Ethan Hunt",    890.00),
            ("CLM-304", "MEM-304", "Fiona Green",   310.00),
            ("CLM-305", "MEM-305", "George Hall",   560.00),
        ]
        for i, (cid, mid, name, billed) in enumerate(bug003_members):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="Batch Processor",
                service_type=ServiceType.INPATIENT,
                service_date=base_date + timedelta(days=60 + i),
                billed_amount=billed, status=ClaimStatus.PENDING,
                is_flagged=True,
                flag_reason="BUG-003: ConcurrentModificationException in batch — claim stuck",
                bug_scenario="BUG-003",
            ))

        # ── BUG-004: Wrong copay — ER billed at primary-care rate (6 records)
        bug004_data = [
            ("CLM-401", "MEM-401", "Helen Troy",    2400.00, 150.00),
            ("CLM-402", "MEM-402", "Ivan Drago",    3200.00, 150.00),
            ("CLM-403", "MEM-403", "Julia Roberts", 1800.00, 150.00),
            ("CLM-404", "MEM-404", "Kevin Hart",    2800.00, 150.00),
            ("CLM-405", "MEM-405", "Laura Palmer",  2100.00, 150.00),
            ("CLM-406", "MEM-406", "Mike Ross",     3500.00, 150.00),
        ]
        for i, (cid, mid, name, billed, correct_copay) in enumerate(bug004_data):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="Emergency Center",
                service_type=ServiceType.EMERGENCY,
                service_date=base_date + timedelta(days=75 + i),
                billed_amount=billed, approved_amount=billed * 0.85,
                patient_responsibility=20.00,  # BUG: $20 instead of $150
                copay_amount=20.00,             # BUG: primary-care copay applied
                status=ClaimStatus.APPROVED, icd10_code="S00.01", cpt_code="99285",
                is_flagged=True,
                flag_reason="BUG-004: ER copay $20 instead of $150 — ServiceType mapping error",
                bug_scenario="BUG-004",
            ))

        # ── BUG-005: Coverage terminated — approved incorrectly (5 records)
        bug005_data = [
            ("CLM-501", "MEM-501", "Nancy Drew",   380.00),
            ("CLM-502", "MEM-502", "Oscar Wilde",  520.00),
            ("CLM-503", "MEM-503", "Penny Lane",   290.00),
            ("CLM-504", "MEM-504", "Quinn Taylor", 640.00),
            ("CLM-505", "MEM-505", "Rosa Parks",   410.00),
        ]
        for i, (cid, mid, name, billed) in enumerate(bug005_data):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="Sunrise Clinic",
                service_type=ServiceType.SPECIALIST,
                service_date=base_date + timedelta(days=90 + i),
                billed_amount=billed, approved_amount=billed * 0.85, patient_responsibility=50.00,
                copay_amount=50.00, status=ClaimStatus.APPROVED, icd10_code="M54.5", cpt_code="99244",
                has_prior_auth=True,
                is_flagged=True,
                flag_reason="BUG-005: Coverage terminated on service date — approved due to off-by-one date check",
                bug_scenario="BUG-005",
            ))

        # ── BUG-006: ICD-10 Z00.xx denied — wellness code not in allowlist (6)
        bug006_data = [
            ("CLM-601", "MEM-601", "Sam Adams",     180.00, "Z00.00"),
            ("CLM-602", "MEM-602", "Tara Reid",     220.00, "Z00.01"),
            ("CLM-603", "MEM-603", "Umar Hassan",   195.00, "Z00.129"),
            ("CLM-604", "MEM-604", "Vera Wang",     175.00, "Z01.00"),
            ("CLM-605", "MEM-605", "Will Smith",    210.00, "Z02.89"),
            ("CLM-606", "MEM-606", "Xena Prince",   185.00, "Z00.00"),
        ]
        for i, (cid, mid, name, billed, icd10) in enumerate(bug006_data):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="City Medical",
                service_type=ServiceType.PRIMARY_CARE,
                service_date=base_date + timedelta(days=105 + i),
                billed_amount=billed, status=ClaimStatus.DENIED,
                denial_reason=f"ICD-10 code {icd10} not found in adjudication allowlist",
                icd10_code=icd10, cpt_code="99395",
                is_flagged=True,
                flag_reason="BUG-006: Wellness ICD-10 Z00-Z13 codes missing from allowlist",
                bug_scenario="BUG-006",
            ))

        # ── BUG-007: Specialist approved without prior auth (5 records) ───
        bug007_data = [
            ("CLM-701", "MEM-701", "Yvonne Carter", 580.00),
            ("CLM-702", "MEM-702", "Zane Clark",    720.00),
            ("CLM-703", "MEM-703", "Anna Bell",     490.00),
            ("CLM-704", "MEM-704", "Ben Stone",     650.00),
            ("CLM-705", "MEM-705", "Clara Webb",    810.00),
        ]
        for i, (cid, mid, name, billed) in enumerate(bug007_data):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="Sunrise Clinic",
                service_type=ServiceType.SPECIALIST,
                service_date=base_date + timedelta(days=120 + i),
                billed_amount=billed, approved_amount=billed * 0.85, patient_responsibility=50.00,
                copay_amount=50.00, status=ClaimStatus.APPROVED, icd10_code="K29.70", cpt_code="99243",
                has_prior_auth=False,  # BUG: approved without prior auth
                is_flagged=True,
                flag_reason="BUG-007: Prior authorization check bypassed — specialist claim approved without auth",
                bug_scenario="BUG-007",
            ))

        # ── BUG-008: Zero-dollar claims passing adjudication (4 records) ──
        bug008_members = [
            ("CLM-801", "MEM-801", "Dan Cooper"),
            ("CLM-802", "MEM-802", "Eve Monroe"),
            ("CLM-803", "MEM-803", "Fred Allen"),
            ("CLM-804", "MEM-804", "Gina Lopez"),
        ]
        for i, (cid, mid, name) in enumerate(bug008_members):
            claims.append(HealthcareClaim(
                claim_id=cid, member_id=mid, member_name=name, provider_name="Data Entry Error",
                service_type=ServiceType.OUTPATIENT,
                service_date=base_date + timedelta(days=135 + i),
                billed_amount=0.00, approved_amount=0.00, patient_responsibility=0.00,
                status=ClaimStatus.APPROVED, icd10_code="Z00.00", cpt_code="99213",
                is_flagged=True,
                flag_reason="BUG-008: Zero-dollar claim passed validation — missing billed_amount > 0 check",
                bug_scenario="BUG-008",
            ))

        session.add_all(claims)
        await session.commit()

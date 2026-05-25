"""
DB Agent Tool — queries the seeded healthcare_claims table to demonstrate
database-driven AI use cases: overcharge detection, denial analysis,
eligibility checks, prior-auth gaps, and ICD-10 validation.
"""
import json
import sqlite3
from langchain_classic.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings


class DBQueryInput(BaseModel):
    query: str = Field(description="Natural language query about healthcare claims data")


class DBAgentTool(BaseTool):
    name: str = "db_agent"
    description: str = (
        "Query the healthcare claims database to analyze patterns, detect billing errors, "
        "find overcharged patients, investigate denial reasons, check eligibility issues, "
        "validate prior-authorization compliance, and surface data quality problems. "
        "Use for any question about claims data, patient billing, or adjudication analytics."
    )
    args_schema: type[BaseModel] = DBQueryInput
    db_session: object = None

    def _get_conn(self) -> sqlite3.Connection:
        db_path = settings.database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _execute(self, query: str) -> str:
        try:
            q = query.lower()

            if any(w in q for w in ["overcharg", "deductible", "boundary", "twice", "billed again"]):
                return self._query_overcharged()
            elif any(w in q for w in ["emergency", "er copay", "wrong copay", "copay mismatch"]):
                return self._query_wrong_copay()
            elif any(w in q for w in ["expired", "terminated", "inactive coverage", "eligibility"]):
                return self._query_expired_coverage()
            elif any(w in q for w in ["icd", "diagnosis code", "wellness denied", "z00"]):
                return self._query_icd10_denied()
            elif any(w in q for w in ["prior auth", "authorization", "specialist without"]):
                return self._query_missing_prior_auth()
            elif any(w in q for w in ["zero", "$0", "zero dollar", "empty"]):
                return self._query_zero_dollar()
            elif any(w in q for w in ["denial", "denied", "rejection"]):
                return self._query_denials()
            elif any(w in q for w in ["pending", "backlog", "unprocessed"]):
                return self._query_pending()
            elif any(w in q for w in ["summary", "overview", "stats", "total", "dashboard"]):
                return self._query_summary()
            elif any(w in q for w in ["flagged", "flag", "anomaly"]):
                return self._query_flagged()
            elif any(w in q for w in ["bug", "scenario", "affected"]):
                return self._query_by_bug_scenario(q)
            else:
                return self._query_summary()

        except Exception as e:
            return json.dumps({"error": str(e), "hint": "Ensure the database has been seeded on startup."})

    def _query_summary(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT
                    COUNT(*) as total_claims,
                    SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status='denied' THEN 1 ELSE 0 END) as denied,
                    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status='flagged' THEN 1 ELSE 0 END) as flagged,
                    SUM(CASE WHEN is_flagged=1 THEN 1 ELSE 0 END) as total_flagged,
                    ROUND(SUM(billed_amount), 2) as total_billed,
                    ROUND(SUM(approved_amount), 2) as total_approved,
                    ROUND(SUM(patient_responsibility), 2) as total_patient_resp
                FROM healthcare_claims
            """)
            row = dict(cur.fetchone())

            bug_cur = conn.execute("""
                SELECT bug_scenario, COUNT(*) as count
                FROM healthcare_claims
                WHERE bug_scenario IS NOT NULL
                GROUP BY bug_scenario
                ORDER BY bug_scenario
            """)
            bug_breakdown = [dict(r) for r in bug_cur.fetchall()]

            return json.dumps({
                "summary": row,
                "bug_scenario_breakdown": bug_breakdown,
                "message": "Healthcare Claims DB — live data from adjudication system",
            }, default=str)
        finally:
            conn.close()

    def _query_overcharged(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, service_date, billed_amount,
                       patient_responsibility, deductible_applied, flag_reason, bug_scenario
                FROM healthcare_claims
                WHERE bug_scenario = 'BUG-002'
                   OR flag_reason LIKE '%deductible%' OR flag_reason LIKE '%overcharge%'
                ORDER BY patient_responsibility DESC
                LIMIT 10
            """)
            rows = [dict(r) for r in cur.fetchall()]
            total = sum(r.get("patient_responsibility", 0) or 0 for r in rows)
            return json.dumps({
                "issue": "Deductible boundary overcharge — patients billed when deductible exactly met",
                "root_cause": "BUG-002: deductibleRemaining > 0 should be >= 0",
                "affected_claims": rows,
                "total_overcharge_amount": round(total, 2),
                "recommendation": "Fix boundary condition and issue credit adjustments to affected members",
            }, default=str)
        finally:
            conn.close()

    def _query_wrong_copay(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, service_type, copay_amount,
                       billed_amount, flag_reason, bug_scenario
                FROM healthcare_claims
                WHERE bug_scenario = 'BUG-004'
                   OR (service_type = 'emergency' AND copay_amount < 100)
                ORDER BY service_date DESC
                LIMIT 10
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "issue": "Wrong copay applied — ER visits billed at primary-care rate ($20 vs $150)",
                "root_cause": "BUG-004: ServiceType mapping error in copay lookup table",
                "affected_claims": rows,
                "financial_impact": f"{len(rows)} claims with potential underbilling of ~$130 each",
                "recommendation": "Correct copay table mapping and reprocess affected claims",
            }, default=str)
        finally:
            conn.close()

    def _query_expired_coverage(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, service_date, denial_reason,
                       flag_reason, bug_scenario, billed_amount
                FROM healthcare_claims
                WHERE bug_scenario = 'BUG-005'
                   OR flag_reason LIKE '%terminated%' OR flag_reason LIKE '%expired%'
                ORDER BY service_date DESC
                LIMIT 10
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "issue": "Claims approved for members with terminated coverage",
                "root_cause": "BUG-005: Coverage termination date boundary is off-by-one (< vs <=)",
                "affected_claims": rows,
                "compliance_risk": "Paying claims for ineligible members — potential fraud exposure",
                "recommendation": "Fix date comparison to use <= terminationDate and audit last 90 days",
            }, default=str)
        finally:
            conn.close()

    def _query_icd10_denied(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, icd10_code, service_type,
                       denial_reason, bug_scenario, billed_amount
                FROM healthcare_claims
                WHERE bug_scenario = 'BUG-006'
                   OR (denial_reason LIKE '%ICD%' OR denial_reason LIKE '%diagnosis%')
                ORDER BY service_date DESC
                LIMIT 10
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "issue": "Valid wellness claims denied due to missing ICD-10 codes in allowlist",
                "root_cause": "BUG-006: ICD-10 Z00.xx wellness codes absent from adjudication allowlist",
                "affected_claims": rows,
                "member_impact": f"{len(rows)} members denied preventive care coverage",
                "recommendation": "Add Z00-Z13 wellness codes to allowlist and reprocess denied claims",
            }, default=str)
        finally:
            conn.close()

    def _query_missing_prior_auth(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, service_type, has_prior_auth,
                       approved_amount, flag_reason, bug_scenario
                FROM healthcare_claims
                WHERE bug_scenario = 'BUG-007'
                   OR (service_type = 'specialist' AND has_prior_auth = 0 AND status = 'approved')
                ORDER BY approved_amount DESC
                LIMIT 10
            """)
            rows = [dict(r) for r in cur.fetchall()]
            total_exposure = sum(r.get("approved_amount", 0) or 0 for r in rows)
            return json.dumps({
                "issue": "Specialist claims approved without required prior authorization",
                "root_cause": "BUG-007: Prior authorization check skipped in adjudicateClaim() flow",
                "affected_claims": rows,
                "financial_exposure": round(total_exposure, 2),
                "fraud_risk": "HIGH — payer liable for unauthorized specialist payments",
                "recommendation": "Add prior-auth gate, claw back payments where contractually allowed",
            }, default=str)
        finally:
            conn.close()

    def _query_zero_dollar(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, billed_amount, approved_amount,
                       patient_responsibility, flag_reason, bug_scenario
                FROM healthcare_claims
                WHERE bug_scenario = 'BUG-008'
                   OR (billed_amount = 0 AND status = 'approved')
                ORDER BY service_date DESC
                LIMIT 10
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "issue": "Zero-dollar claims passing adjudication — data quality failure",
                "root_cause": "BUG-008: Missing billed_amount > 0 validation at claim submission",
                "affected_claims": rows,
                "audit_risk": "Zero-dollar EOBs confuse members and pollute financial reporting",
                "recommendation": "Add input validation: reject claims where billed_amount <= 0",
            }, default=str)
        finally:
            conn.close()

    def _query_denials(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT denial_reason, COUNT(*) as count,
                       ROUND(SUM(billed_amount), 2) as total_billed
                FROM healthcare_claims
                WHERE status = 'denied' AND denial_reason IS NOT NULL
                GROUP BY denial_reason
                ORDER BY count DESC
                LIMIT 10
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "denial_reasons": rows,
                "insight": "Top denial categories — use this to prioritize process improvements",
            }, default=str)
        finally:
            conn.close()

    def _query_pending(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, service_type, billed_amount,
                       service_date, bug_scenario
                FROM healthcare_claims
                WHERE status = 'pending'
                ORDER BY service_date ASC
                LIMIT 15
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "pending_claims": rows,
                "count": len(rows),
                "oldest_pending": rows[0].get("service_date") if rows else None,
                "note": "BUG-003 (ConcurrentModificationException) may be causing batch stalls",
            }, default=str)
        finally:
            conn.close()

    def _query_flagged(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT claim_id, member_name, service_type, billed_amount,
                       flag_reason, bug_scenario, status
                FROM healthcare_claims
                WHERE is_flagged = 1
                ORDER BY billed_amount DESC
                LIMIT 15
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "flagged_claims": rows,
                "total_flagged": len(rows),
                "message": "These claims require manual review or re-adjudication",
            }, default=str)
        finally:
            conn.close()

    def _query_by_bug_scenario(self, q: str) -> str:
        bug_id = None
        for b in ["BUG-001", "BUG-002", "BUG-003", "BUG-004", "BUG-005", "BUG-006", "BUG-007", "BUG-008"]:
            if b.lower() in q:
                bug_id = b
                break

        if not bug_id:
            return self._query_summary()

        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT * FROM healthcare_claims
                WHERE bug_scenario = ?
                LIMIT 10
            """, (bug_id,))
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "bug_scenario": bug_id,
                "affected_claims": rows,
                "count": len(rows),
            }, default=str)
        finally:
            conn.close()

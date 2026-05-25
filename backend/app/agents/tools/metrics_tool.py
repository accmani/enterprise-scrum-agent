"""
Metrics Tool — queries the agent_metrics table to surface performance analytics.
Shows: defects fixed, resolution time, agent utilization, category breakdown.
"""
import json
import sqlite3
from langchain_classic.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings


class MetricsQueryInput(BaseModel):
    query: str = Field(description="Natural language query about agent performance metrics")


class MetricsTool(BaseTool):
    name: str = "metrics_tool"
    description: str = (
        "Query agent performance metrics: total invocations, defects fixed per category, "
        "success rates, average response times, persona utilization, and SDLC stage analytics. "
        "Use when asked about agent performance, productivity, quality metrics, or team velocity."
    )
    args_schema: type[BaseModel] = MetricsQueryInput

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

            if any(w in q for w in ["defect", "bug", "fix", "resolved"]):
                return self._defect_metrics()
            elif any(w in q for w in ["persona", "agent", "utilization", "usage"]):
                return self._persona_metrics()
            elif any(w in q for w in ["time", "duration", "latency", "performance", "speed"]):
                return self._performance_metrics()
            elif any(w in q for w in ["category", "sdlc", "stage", "phase"]):
                return self._category_metrics()
            else:
                return self._overview_metrics()

        except Exception as e:
            return json.dumps({"error": str(e)})

    def _overview_metrics(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT
                    COUNT(*) as total_invocations,
                    SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN success=0 THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN is_defect_fix=1 THEN 1 ELSE 0 END) as defects_fixed,
                    ROUND(AVG(duration_ms), 0) as avg_duration_ms,
                    ROUND(AVG(CASE WHEN success=1 THEN duration_ms END), 0) as avg_success_duration_ms
                FROM agent_metrics
            """)
            row = dict(cur.fetchone())

            # Recent activity (last 7 days)
            recent_cur = conn.execute("""
                SELECT COUNT(*) as recent_count
                FROM agent_metrics
                WHERE created_at >= datetime('now', '-7 days')
            """)
            recent = dict(recent_cur.fetchone())

            success_rate = (
                round(row["successful"] / row["total_invocations"] * 100, 1)
                if row["total_invocations"] > 0 else 0
            )

            return json.dumps({
                "overview": {
                    **row,
                    "success_rate_pct": success_rate,
                    "invocations_last_7_days": recent["recent_count"],
                },
                "message": "Enterprise Scrum Agent — live performance metrics",
            })
        finally:
            conn.close()

    def _defect_metrics(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT
                    defect_category,
                    defect_severity,
                    COUNT(*) as count,
                    ROUND(AVG(duration_ms), 0) as avg_resolution_ms
                FROM agent_metrics
                WHERE is_defect_fix = 1
                GROUP BY defect_category, defect_severity
                ORDER BY count DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]

            total_cur = conn.execute("""
                SELECT COUNT(*) as total FROM agent_metrics WHERE is_defect_fix=1
            """)
            total = dict(total_cur.fetchone())["total"]

            return json.dumps({
                "total_defects_fixed": total,
                "breakdown_by_category": rows,
                "insight": "Higher resolution time for critical bugs indicates complex root causes",
            })
        finally:
            conn.close()

    def _persona_metrics(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT
                    persona,
                    super_agent,
                    COUNT(*) as invocations,
                    SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) as successful,
                    ROUND(AVG(duration_ms), 0) as avg_duration_ms
                FROM agent_metrics
                GROUP BY persona
                ORDER BY invocations DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "persona_utilization": rows,
                "insight": "Most-used persona indicates primary team workflow focus",
            })
        finally:
            conn.close()

    def _performance_metrics(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT
                    super_agent,
                    COUNT(*) as invocations,
                    ROUND(MIN(duration_ms), 0) as min_ms,
                    ROUND(AVG(duration_ms), 0) as avg_ms,
                    ROUND(MAX(duration_ms), 0) as max_ms
                FROM agent_metrics
                GROUP BY super_agent
                ORDER BY avg_ms DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "latency_by_super_agent": rows,
                "note": "High avg_ms in Engineering agents reflects multi-step code review chains",
            })
        finally:
            conn.close()

    def _category_metrics(self) -> str:
        conn = self._get_conn()
        try:
            cur = conn.execute("""
                SELECT
                    query_category,
                    COUNT(*) as invocations,
                    SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN is_defect_fix=1 THEN 1 ELSE 0 END) as defect_fixes
                FROM agent_metrics
                GROUP BY query_category
                ORDER BY invocations DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return json.dumps({
                "sdlc_stage_distribution": rows,
                "insight": "Distribution shows where AI effort is concentrated in your SDLC",
            })
        finally:
            conn.close()

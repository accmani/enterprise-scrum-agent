"""
Metrics API — exposes agent performance data for the frontend dashboard.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.database import get_db
from app.models.metrics import AgentMetric

router = APIRouter()


@router.get("/overview")
async def metrics_overview(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((AgentMetric.success == True, 1), else_=0)).label("successful"),
            func.sum(case((AgentMetric.is_defect_fix == True, 1), else_=0)).label("defects_fixed"),
            func.avg(AgentMetric.duration_ms).label("avg_duration_ms"),
        )
    )
    row = result.one()
    total = row.total or 0
    successful = row.successful or 0
    return {
        "total_invocations": total,
        "successful": successful,
        "failed": total - successful,
        "defects_fixed": row.defects_fixed or 0,
        "success_rate_pct": round(successful / total * 100, 1) if total > 0 else 0,
        "avg_duration_ms": round(row.avg_duration_ms or 0, 0),
    }


@router.get("/by-persona")
async def metrics_by_persona(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            AgentMetric.persona,
            AgentMetric.super_agent,
            func.count().label("invocations"),
            func.sum(case((AgentMetric.success == True, 1), else_=0)).label("successful"),
            func.avg(AgentMetric.duration_ms).label("avg_duration_ms"),
        ).group_by(AgentMetric.persona, AgentMetric.super_agent)
        .order_by(func.count().desc())
    )
    rows = result.all()
    return {
        "by_persona": [
            {
                "persona": r.persona,
                "super_agent": r.super_agent,
                "invocations": r.invocations,
                "successful": r.successful or 0,
                "avg_duration_ms": round(r.avg_duration_ms or 0, 0),
            }
            for r in rows
        ]
    }


@router.get("/by-category")
async def metrics_by_category(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            AgentMetric.query_category,
            func.count().label("invocations"),
            func.sum(case((AgentMetric.is_defect_fix == True, 1), else_=0)).label("defect_fixes"),
        ).group_by(AgentMetric.query_category)
        .order_by(func.count().desc())
    )
    rows = result.all()
    return {
        "by_category": [
            {
                "category": r.query_category,
                "invocations": r.invocations,
                "defect_fixes": r.defect_fixes or 0,
            }
            for r in rows
        ]
    }


@router.get("/defects")
async def defect_metrics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            AgentMetric.defect_category,
            AgentMetric.defect_severity,
            func.count().label("count"),
            func.avg(AgentMetric.duration_ms).label("avg_resolution_ms"),
        )
        .where(AgentMetric.is_defect_fix == True)
        .group_by(AgentMetric.defect_category, AgentMetric.defect_severity)
        .order_by(func.count().desc())
    )
    rows = result.all()
    return {
        "defects_by_category": [
            {
                "category": r.defect_category or "uncategorized",
                "severity": r.defect_severity or "unknown",
                "count": r.count,
                "avg_resolution_ms": round(r.avg_resolution_ms or 0, 0),
            }
            for r in rows
        ]
    }


@router.get("/recent")
async def recent_activity(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentMetric)
        .order_by(AgentMetric.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return {
        "recent": [
            {
                "id": r.id,
                "persona": r.persona,
                "super_agent": r.super_agent,
                "query_preview": r.query_preview,
                "query_category": r.query_category,
                "duration_ms": r.duration_ms,
                "success": r.success,
                "is_defect_fix": r.is_defect_fix,
                "defect_severity": r.defect_severity,
                "defect_category": r.defect_category,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.get("/trend")
async def activity_trend(days: int = 7, db: AsyncSession = Depends(get_db)):
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(AgentMetric)
        .where(AgentMetric.created_at >= cutoff)
        .order_by(AgentMetric.created_at)
    )
    rows = result.scalars().all()

    # Group by day
    day_map: dict[str, dict] = {}
    for r in rows:
        day = r.created_at.strftime("%Y-%m-%d") if r.created_at else "unknown"
        if day not in day_map:
            day_map[day] = {"date": day, "invocations": 0, "defect_fixes": 0, "errors": 0}
        day_map[day]["invocations"] += 1
        if r.is_defect_fix:
            day_map[day]["defect_fixes"] += 1
        if not r.success:
            day_map[day]["errors"] += 1

    return {"trend": list(day_map.values())}

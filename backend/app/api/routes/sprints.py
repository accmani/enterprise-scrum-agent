from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.sprint import Sprint, SprintStatus

router = APIRouter()


class SprintCreate(BaseModel):
    name: str
    goal: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintUpdate(BaseModel):
    name: str | None = None
    goal: str | None = None
    status: SprintStatus | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    velocity: int | None = None


@router.get("/")
async def list_sprints(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sprint).order_by(Sprint.created_at.desc()))
    sprints = result.scalars().all()
    return {"sprints": [
        {
            "id": s.id, "name": s.name, "goal": s.goal,
            "status": s.status, "start_date": s.start_date,
            "end_date": s.end_date, "velocity": s.velocity,
        }
        for s in sprints
    ]}


@router.post("/", status_code=201)
async def create_sprint(data: SprintCreate, db: AsyncSession = Depends(get_db)):
    sprint = Sprint(**data.model_dump(exclude_none=True))
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return {"id": sprint.id, "name": sprint.name, "status": sprint.status}


@router.get("/{sprint_id}")
async def get_sprint(sprint_id: int, db: AsyncSession = Depends(get_db)):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint


@router.patch("/{sprint_id}")
async def update_sprint(sprint_id: int, data: SprintUpdate, db: AsyncSession = Depends(get_db)):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(sprint, field, value)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.delete("/{sprint_id}", status_code=204)
async def delete_sprint(sprint_id: int, db: AsyncSession = Depends(get_db)):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    await db.delete(sprint)
    await db.commit()

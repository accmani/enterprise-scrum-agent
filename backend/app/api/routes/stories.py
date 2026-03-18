from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.story import Story, StoryStatus, StorySizeEnum

router = APIRouter()


class StoryCreate(BaseModel):
    title: str
    description: str | None = None
    acceptance_criteria: str | None = None
    story_points: float | None = None
    size: StorySizeEnum | None = None
    assignee: str | None = None
    sprint_id: int | None = None


class StoryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    acceptance_criteria: str | None = None
    story_points: float | None = None
    size: StorySizeEnum | None = None
    status: StoryStatus | None = None
    assignee: str | None = None
    sprint_id: int | None = None


@router.get("/")
async def list_stories(sprint_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Story).order_by(Story.created_at.desc())
    if sprint_id:
        query = query.where(Story.sprint_id == sprint_id)
    result = await db.execute(query)
    stories = result.scalars().all()
    return {"stories": [
        {
            "id": s.id, "title": s.title, "description": s.description,
            "story_points": s.story_points, "size": s.size,
            "status": s.status, "assignee": s.assignee,
            "sprint_id": s.sprint_id, "jira_key": s.jira_key,
        }
        for s in stories
    ]}


@router.post("/", status_code=201)
async def create_story(data: StoryCreate, db: AsyncSession = Depends(get_db)):
    story = Story(**data.model_dump(exclude_none=True))
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return {"id": story.id, "title": story.title, "status": story.status}


@router.get("/{story_id}")
async def get_story(story_id: int, db: AsyncSession = Depends(get_db)):
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.patch("/{story_id}")
async def update_story(story_id: int, data: StoryUpdate, db: AsyncSession = Depends(get_db)):
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(story, field, value)
    await db.commit()
    await db.refresh(story)
    return story


@router.delete("/{story_id}", status_code=204)
async def delete_story(story_id: int, db: AsyncSession = Depends(get_db)):
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    await db.delete(story)
    await db.commit()

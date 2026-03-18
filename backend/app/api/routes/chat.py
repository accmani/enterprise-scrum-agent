from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.agents.mrkl_agent import ScrumMRKLAgent

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    history: list[dict] | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str | None = None


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    agent = ScrumMRKLAgent(db_session=db)
    reply = await agent.run(request.message, session_history=request.history)
    return ChatResponse(reply=reply, session_id=request.session_id)


@router.get("/health")
async def chat_health():
    return {"status": "ok"}

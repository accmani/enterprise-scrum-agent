from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.api.routes import chat, sprints, stories


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Enterprise Scrum Agent API",
    description="AI-powered Scrum management with MRKL agents",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(sprints.router, prefix="/api/sprints", tags=["sprints"])
app.include_router(stories.router, prefix="/api/stories", tags=["stories"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "enterprise-scrum-agent"}
